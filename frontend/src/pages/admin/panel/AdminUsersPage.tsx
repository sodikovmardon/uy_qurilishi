import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Loader2,
  Ban,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Eye,
} from 'lucide-react';
import { api, type SiteAdminUser, type SiteAdminUserRow } from '../../../api/client';
import { useApp } from '../../../context/AppContext';

function UserDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { showToast } = useApp();
  const [user, setUser] = useState<SiteAdminUser | null>(null);

  useEffect(() => {
    api.siteAdminUserDetail(id).then(setUser).catch(() => showToast('Yuklashda xatolik', 'error'));
  }, [id, showToast]);

  if (!user) return null;

  const suspend = async (active: boolean) => {
    if (active && !window.confirm(`Foydalanuvchi "${user.name}" faolsizlantirilsinmi?`)) return;
    if (!active && !window.confirm(`Foydalanuvchi "${user.name}" qayta faollashtirilsinmi?`)) return;
    try {
      await api.siteAdminUserUpdate(id, { is_active: active });
      showToast(active ? 'Foydalanuvchi faollashtirildi' : 'Foydalanuvchi faolsizlantirildi');
      setUser({ ...user, is_active: active });
    } catch {
      showToast('Xatolik', 'error');
    }
  };

  const toggleAdmin = async () => {
    if (!user.is_staff && !window.confirm(`"${user.name}"ga admin huquqi berilsinmi?`)) return;
    if (user.is_staff && !window.confirm(`"${user.name}"dan admin huquqi olib tashlansinmi?`)) return;
    try {
      await api.siteAdminUserUpdate(id, { is_staff: !user.is_staff });
      showToast(user.is_staff ? 'Admin huquqi olib tashlandi' : 'Admin huquqi berildi');
      setUser({ ...user, is_staff: !user.is_staff });
    } catch {
      showToast('Xatolik', 'error');
    }
  };

  const remove = async () => {
    if (!window.confirm(`"${user.name}" hisobi va barcha ma'lumotlari butunlay o'chirilsinmi? Bu amal qaytarib bo'lmaydi.`)) return;
    try {
      await api.siteAdminUserDelete(id);
      showToast('Foydalanuvchi o\'chirildi');
      onClose();
    } catch {
      showToast('O\'chirishda xatolik', 'error');
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h2>{user.name}</h2>
          <span className={`admin-badge ${user.is_active ? 'admin-badge-approved' : 'admin-badge-rejected'}`}>
            {user.is_active ? 'Faol' : 'Faolsiz'}
          </span>
          <button className="admin-icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-user-meta">
            <div><span>Telefon</span><strong>{user.phone}</strong></div>
            <div><span>Ro'yxatdan o'tgan</span><strong>{new Date(user.date_joined).toLocaleDateString('uz-UZ')}</strong></div>
            <div><span>So'nggi faollik</span><strong>{user.last_login ? new Date(user.last_login).toLocaleDateString('uz-UZ') : '—'}</strong></div>
            <div><span>Status</span><strong>{user.is_staff ? 'Admin' : 'Foydalanuvchi'}</strong></div>
          </div>

          {user.projects.length > 0 ? (
            <>
              <h3>Loyihalar ({user.projects.length})</h3>
              <div className="admin-user-projects">
                {user.projects.map((p) => (
                  <div key={p.id} className="admin-user-project">
                    <span>#{p.id}</span>
                    <span>{p.area} m² · {p.rooms} xona</span>
                    <span className={`admin-badge ${(STATUS_CLS as Record<string, string>)[p.status] || 'admin-badge-pending'}`}>
                      {(STATUS_LABEL as Record<string, string>)[p.status] || p.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="admin-empty-inline">Foydalanuvchida loyihalar yo'q</p>
          )}
        </div>

        <div className="admin-modal-foot">
          <button className="btn btn-secondary" onClick={toggleAdmin}>
            {user.is_staff ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            {user.is_staff ? 'Admin huquqini olib tashlash' : 'Admin huquqi berish'}
          </button>
          <button className="btn btn-secondary" onClick={() => suspend(!user.is_active)}>
            <Ban className="w-4 h-4" />
            {user.is_active ? 'Faolsizlantirish' : 'Faollashtirish'}
          </button>
          <button className="btn btn-danger" onClick={remove}>
            <Trash2 className="w-4 h-4" /> O'chirish
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_CLS: Record<string, string> = {
  pending: 'admin-badge-pending',
  approved: 'admin-badge-approved',
  rejected: 'admin-badge-rejected',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
};

export function AdminUsersPage() {
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState<{ total: number; results: SiteAdminUserRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .siteAdminUsers({ search: search || undefined, status: statusFilter || undefined })
      .then(setData)
      .catch(() => showToast('Yuklashda xatolik', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(load, [load]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Foydalanuvchilar</h1>
        <p>Ro'yxatdan o'tgan barcha foydalanuvchilar</p>
      </div>

      <div className="admin-table-toolbar">
        <div className="admin-search">
          <Search className="w-4 h-4 admin-search-icon" />
          <input
            className="admin-search-input"
            placeholder="Qidirish (ism, telefon)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="control admin-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Barchasi</option>
          <option value="active">Faol</option>
          <option value="suspended">Faolsiz</option>
          <option value="admin">Adminlar</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 className="w-6 h-6 admin-spin" /> Yuklanmoqda...</div>
      ) : !data || data.results.length === 0 ? (
        <div className="admin-empty">Foydalanuvchilar topilmadi</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th>Ro'yxatdan o'tgan</th>
                <th>Loyihalar</th>
                <th>So'nggi faollik</th>
                <th>Holat</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.phone}</td>
                  <td>{new Date(u.date_joined).toLocaleDateString('uz-UZ')}</td>
                  <td>{u.project_count}</td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleDateString('uz-UZ') : '—'}</td>
                  <td>
                    <span className={`admin-badge ${u.is_active ? 'admin-badge-approved' : 'admin-badge-rejected'}`}>
                      {u.is_active ? 'Faol' : 'Faolsiz'}
                    </span>
                  </td>
                  <td>
                    {u.is_staff ? <span className="admin-tag admin-tag-admin">Admin</span> : <span className="admin-tag">Foydalanuvchi</span>}
                  </td>
                  <td>
                    <button className="admin-icon-btn" onClick={() => setDetailId(u.id)} aria-label="Ko'rish">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId !== null && <UserDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
