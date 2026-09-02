import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Pencil,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { api, type SiteAdminProject, type SiteAdminProjectRow } from '../../../api/client';
import { useApp } from '../../../context/AppContext';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Kutilmoqda', cls: 'admin-badge-pending' },
  approved: { label: 'Tasdiqlangan', cls: 'admin-badge-approved' },
  rejected: { label: 'Rad etilgan', cls: 'admin-badge-rejected' },
};

function ProjectDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useApp();
  const [project, setProject] = useState<SiteAdminProject | null>(null);
  const [edit, setEdit] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api.siteAdminProjectDetail(id).then(setProject).catch(() => showToast('Loyihani yuklashda xatolik', 'error'));
  }, [id, showToast]);

  useEffect(load, [load]);

  if (!project) return null;

  const statusMeta = STATUS_META[project.status] || STATUS_META.pending;

  const field = (key: string, label: string, type = 'text', opts: string[] = []) => {
    const val = String((project as unknown as Record<string, unknown>)[key] ?? '');
    if (!edit) {
      return (
        <div className="admin-detail-field">
          <span className="admin-detail-label">{label}</span>
          <span className="admin-detail-value">{val || '—'}</span>
        </div>
      );
    }
    return (
      <div className="admin-detail-field">
        <span className="admin-detail-label">{label}</span>
        {type === 'select' ? (
          <select
            className="control"
            value={val}
            onChange={(e) => setProject({ ...project, [key]: e.target.value })}
          >
            {opts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            className="control"
            type={type === 'number' ? 'number' : 'text'}
            value={val}
            onChange={(e) => setProject({ ...project, [key]: e.target.value })}
          />
        )}
      </div>
    );
  };

  const save = async () => {
    setEditing(true);
    try {
      await api.siteAdminProjectUpdate(id, {
        user_name: project.user_name,
        area: Number(project.area),
        rooms: Number(project.rooms),
        bathrooms: Number(project.bathrooms),
        has_pool: project.has_pool,
        has_garage: project.has_garage,
        has_terrace: project.has_terrace,
      });
      setEdit(false);
      showToast('Loyiha tahrirlandi');
      onChanged();
    } catch {
      showToast('Saqlashda xatolik', 'error');
    } finally {
      setEditing(false);
    }
  };

  const approve = async () => {
    try {
      await api.siteAdminProjectBulkAction('approve', [id]);
      showToast(`Loyiha #${id} tasdiqlandi`);
      onChanged();
      load();
    } catch {
      showToast('Xatolik', 'error');
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      showToast('Rad etish sababini kiriting', 'error');
      return;
    }
    try {
      await api.siteAdminProjectBulkAction('reject', [id], rejectReason);
      showToast(`Loyiha #${id} rad etildi`);
      onChanged();
      load();
    } catch {
      showToast('Xatolik', 'error');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Loyiha #${id} butunlay o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    try {
      await api.siteAdminProjectDelete(id);
      showToast(`Loyiha #${id} o'chirildi`);
      onChanged();
      onClose();
    } catch {
      showToast('O\'chirishda xatolik', 'error');
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal admin-modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h2>Loyiha #{project.id}</h2>
          <span className={`admin-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
          <button className="admin-icon-btn" onClick={onClose} aria-label="Yopish">×</button>
        </div>

        <div className="admin-modal-body">
          {project.images.length > 0 && (
            <img src={project.images[0]} alt="Loyiha" className="admin-detail-img" />
          )}

          <div className="admin-detail-grid">
            {field('user_name', 'Yuboruvchi')}
            {field('area', 'Maydon (m²)', 'number')}
            {field('rooms', 'Xonalar', 'number')}
            {field('bathrooms', 'Hammomlar', 'number')}
            {field('source', 'Manba')}
            <div className="admin-detail-field">
              <span className="admin-detail-label">Yakunlangan</span>
              <span className="admin-detail-value">
                {new Date(project.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="admin-detail-features">
            {project.has_pool && <span className="admin-tag">Basseyin</span>}
            {project.has_garage && <span className="admin-tag">Garaj</span>}
            {project.has_terrace && <span className="admin-tag">Terassa</span>}
          </div>

          {project.status === 'rejected' && (
            <div className="admin-reject-reason">
              <strong>Bu loyiha rad etilgan.</strong> Rad etish sababi Audit jurnalida yozib qo'yilgan.
            </div>
          )}

          {project.status === 'pending' && (
            <div className="admin-reject-box">
              <label>Rad etish sababi (yuboruvchiga ko'rsatiladi)</label>
              <textarea
                className="admin-textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Rad etish sababini kiriting"
              />
            </div>
          )}

          <Link to={`/loyihalar/${project.id}`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
            <Eye className="w-4 h-4" /> Saytda ko'rish
          </Link>
        </div>

        <div className="admin-modal-foot">
          {project.status === 'pending' && (
            <>
              <button className="btn btn-primary" onClick={approve}>
                <CheckCircle2 className="w-4 h-4" /> Tasdiqlash
              </button>
              <button className="btn btn-danger" onClick={reject}>
                <XCircle className="w-4 h-4" /> Rad etish
              </button>
            </>
          )}
          {!edit ? (
            <button className="btn btn-secondary" onClick={() => setEdit(true)}>
              <Pencil className="w-4 h-4" /> Tahrirlash
            </button>
          ) : (
            <button className="btn btn-primary" onClick={save} disabled={editing}>
              {editing ? <Loader2 className="w-4 h-4 admin-spin" /> : 'Saqlash'}
            </button>
          )}
          <button className="btn btn-danger" onClick={remove}>
            <Trash2 className="w-4 h-4" /> O'chirish
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminProjectsPage() {
  const { showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [search, setSearch] = useState('');
  const [data, setData] = useState<{ total: number; results: SiteAdminProjectRow[]; page: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .siteAdminProjects({ status: status || undefined, search: search || undefined, page: 1, per_page: 25 })
      .then(setData)
      .catch(() => showToast('Loyihalarni yuklashda xatolik', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  useEffect(load, [load]);

  const setStatus = (s: string) => {
    if (s) params.set('status', s);
    else params.delete('status');
    setParams(params, { replace: true });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    const ids = data.results.map((r) => r.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  const bulkAction = async (action: 'approve' | 'reject') => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'reject' && !window.confirm(`${ids.length} ta loyiha rad etilsinmi?`)) return;
    try {
      await api.siteAdminProjectBulkAction(action, ids);
      showToast(`${ids.length} ta loyiha ${action === 'approve' ? 'tasdiqlandi' : 'rad etildi'}`);
      setSelected(new Set());
      load();
    } catch {
      showToast('Xatolik', 'error');
    }
  };

  const tabs = [
    { key: '', label: 'Barchasi' },
    { key: 'pending', label: 'Kutilmoqda' },
    { key: 'approved', label: 'Tasdiqlangan' },
    { key: 'rejected', label: 'Rad etilgan' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Loyihalar</h1>
        <p>Barcha loyihalarni moderatsiya qilish</p>
      </div>

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`admin-tab${status === t.key ? ' is-active' : ''}`}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
            {t.key === 'pending' && data ? (
              <span className="admin-tab-count">{data.total}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="admin-table-toolbar">
        <div className="admin-search">
          <Search className="w-4 h-4 admin-search-icon" />
          <input
            className="admin-search-input"
            placeholder="Qidirish (nomi, ID)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.size > 0 && (
          <div className="admin-bulk-actions">
            <span>{selected.size} ta tanlangan</span>
            <button className="btn btn-primary btn-sm" onClick={() => bulkAction('approve')}>
              <CheckCircle2 className="w-4 h-4" /> Tasdiqlash
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => bulkAction('reject')}>
              <XCircle className="w-4 h-4" /> Rad etish
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 className="w-6 h-6 admin-spin" /> Yuklanmoqda...</div>
      ) : !data || data.results.length === 0 ? (
        <div className="admin-empty">
          <Filter className="w-6 h-6" />
          Loyihalar topilmadi
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-check-col">
                  <input type="checkbox" checked={selected.size === data.results.length} onChange={toggleAll} />
                </th>
                <th>Loyiha</th>
                <th>Yuboruvchi</th>
                <th>Maydon</th>
                <th>Xonalar</th>
                <th>Sanasi</th>
                <th>Holat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((p) => {
                const meta = STATUS_META[p.status] || STATUS_META.pending;
                return (
                  <tr key={p.id} onClick={() => setDetailId(p.id)} style={{ cursor: 'pointer' }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td>
                      <div className="admin-proj-cell">
                        {p.images.length > 0 ? (
                          <img src={p.images[0]} alt="" className="admin-proj-thumb" />
                        ) : (
                          <span className="admin-proj-thumb admin-proj-thumb-none">#{p.id}</span>
                        )}
                        <span className="admin-proj-title">Loyiha #{p.id}</span>
                      </div>
                    </td>
                    <td>{p.user_name || 'Anonim'}</td>
                    <td>{p.area} m²</td>
                    <td>{p.rooms}</td>
                    <td>{new Date(p.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}</td>
                    <td><span className={`admin-badge ${meta.cls}`}>{meta.label}</span></td>
                    <td>
                      <button
                        className="admin-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailId(p.id);
                        }}
                        aria-label="Ko'rish"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailId !== null && (
        <ProjectDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
