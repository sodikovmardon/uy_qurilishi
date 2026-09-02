import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  Loader2,
  Activity,
  UserPlus,
  Calculator,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { api, type SiteAdminDashboard } from '../../../api/client';

const W = 560;
const H = 160;
const PAD = 24;

function MiniChart({
  signups,
  projects,
}: {
  signups: { date: string; count: number }[];
  projects: { date: string; count: number }[];
}) {
  const both = useMemo(() => {
    const all = signups.map((s) => ({ ...s, signups: s.count, projects: 0 }));
    const byDate = new Map(all.map((d) => [d.date, d]));
    projects.forEach((p) => {
      const el = byDate.get(p.date);
      if (el) el.projects += p.count;
    });
    return [...byDate.values()];
  }, [signups, projects]);

  const max = useMemo(
    () => Math.max(1, ...both.map((d) => Math.max(d.signups, d.projects))),
    [both],
  );

  const series = useMemo(() => {
    const signupPts = both.map((d, i) => ({
      x: PAD + (i * (W - PAD * 2)) / Math.max(1, both.length - 1),
      y: H - PAD - (d.signups / max) * (H - PAD * 2),
    }));
    const projPts = both.map((d, i) => ({
      x: PAD + (i * (W - PAD * 2)) / Math.max(1, both.length - 1),
      y: H - PAD - (d.projects / max) * (H - PAD * 2),
    }));
    const sLine = signupPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const pLine = projPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const sArea = `${sLine} L${signupPts[signupPts.length - 1]?.x.toFixed(1)},${H - PAD} L${signupPts[0]?.x.toFixed(1)},${H - PAD} Z`;
    return { sLine, pLine, sArea, signupPts, projPts };
  }, [both, max]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="admin-chart" role="img" aria-label="So'nggi 30 kun">
      {Array.from({ length: 5 }).map((_, i) => {
        const y = PAD + (i * (H - PAD * 2)) / 4;
        return <line key={i} x1={PAD} x2={W - PAD} y1={y} y2={y} className="admin-chart-grid" />;
      })}
      <path d={series.sArea} className="admin-chart-area-signups" />
      <path d={series.sLine} className="admin-chart-line-signups" />
      <path d={series.pLine} className="admin-chart-line-projects" />
      {series.signupPts.filter((_, i) => i % 3 === 0).map((p, i) => (
        <circle key={`s${i}`} cx={p.x} cy={p.y} r={2} className="admin-chart-dot-signups" />
      ))}
      {series.projPts.filter((_, i) => i % 3 === 0).map((p, i) => (
        <circle key={`p${i}`} cx={p.x} cy={p.y} r={2} className="admin-chart-dot-projects" />
      ))}
    </svg>
  );
}

export function AdminDashboardPage() {
  const [data, setData] = useState<SiteAdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .siteAdminDashboard()
      .then((d) => setData(d))
      .catch(() => setError('Dashboard ma\'lumotlarini yuklashda xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 className="w-6 h-6 admin-spin" />
        Yuklanmoqda...
      </div>
    );
  }

  if (error || !data) {
    return <div className="admin-error">{error || 'Ma\'lumot topilmadi'}</div>;
  }

  const s = data.stats;

  const cards = [
    { label: 'Jami foydalanuvchilar', value: s.users_total, icon: Users, tone: 'blue' },
    { label: 'Jami loyihalar', value: s.projects_total, icon: FolderKanban, tone: 'green' },
    { label: 'Kutilayotgan tasdiqlar', value: s.projects_pending, icon: Activity, tone: 'amber' },
    { label: 'Bugungi ro\'yxatdan o\'tishlar', value: s.users_today, icon: UserPlus, tone: 'purple' },
    { label: 'Faol (7 kun)', value: s.users_active_week, icon: Users, tone: 'teal' },
    { label: 'Buyurtmalar', value: s.orders_total, icon: ShoppingBag, tone: 'pink' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Boshqaruv paneli</h1>
        <p>Sayt ko'rsatkichlari va diqqat talab qiluvchi ishlar</p>
      </div>

      <div className="admin-stat-grid">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`admin-stat-card admin-stat-${c.tone}`}>
              <span className="admin-stat-icon">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <div className="admin-stat-value">{c.value}</div>
                <div className="admin-stat-label">{c.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-dash-grid">
        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Faollik (so'nggi 30 kun)</h2>
            <div className="admin-legend">
              <span className="admin-legend-item admin-legend-signups">Ro'yxatdan o'tishlar</span>
              <span className="admin-legend-item admin-legend-projects">Loyihalar</span>
            </div>
          </div>
          <MiniChart signups={data.daily_signups} projects={data.daily_projects} />
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Diqqat talab qiladi</h2>
          </div>
          {data.pending_projects.length === 0 ? (
            <div className="admin-pending-empty">
              <CheckCircle2 className="w-6 h-6" />
              Tasdiqlash kutilayotgan loyihalar yo'q
            </div>
          ) : (
            <ul className="admin-pending-list">
              {data.pending_projects.map((p) => (
                <li key={p.id}>
                  <AlertTriangle className="w-4 h-4 admin-pending-icon" />
                  <div className="admin-pending-info">
                    <strong>Loyiha #{p.id}</strong>
                    <span>{p.user_name || 'Anonim'} · {p.area} m² · {p.rooms} xona</span>
                  </div>
                  <Link to={`/admin/loyihalar?status=pending`} className="btn btn-primary btn-sm">
                    Ko'rib chiqish <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <h2>Umumiy holat</h2>
        </div>
        <div className="admin-overview-grid">
          <div><span>Tasdiqlangan</span><strong>{s.projects_approved}</strong></div>
          <div><span>Rad etilgan</span><strong>{s.projects_rejected}</strong></div>
          <div><span>Kutilmoqda</span><strong>{s.projects_pending}</strong></div>
          <div><span>Bugun yuborilgan</span><strong>{s.projects_today}</strong></div>
          <div><span>Mahsulotlar</span><strong>{s.products_total}</strong></div>
          <div><span>Kalkulyatsiyalar</span><strong>{s.projects_total}</strong></div>
        </div>
      </div>
    </div>
  );
}
