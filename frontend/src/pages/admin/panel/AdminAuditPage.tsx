import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, ScrollText } from 'lucide-react';
import { api, type SiteAdminAuditRow } from '../../../api/client';
import { useApp } from '../../../context/AppContext';

export function AdminAuditPage() {
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [data, setData] = useState<{ total: number; results: SiteAdminAuditRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .siteAdminAudit({ action: search || undefined })
      .then(setData)
      .catch(() => showToast('Audit jurnalini yuklashda xatolik', 'error'))
      .finally(() => setLoading(false));
  }, [search, showToast]);

  useEffect(load, [load]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Audit jurnali</h1>
        <p>Barcha admin harakatlari — faqat o'qish uchun</p>
      </div>

      <div className="admin-table-toolbar">
        <div className="admin-search">
          <Search className="w-4 h-4 admin-search-icon" />
          <input
            className="admin-search-input"
            placeholder="Harakat bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 className="w-6 h-6 admin-spin" /> Yuklanmoqda...</div>
      ) : !data || data.results.length === 0 ? (
        <div className="admin-empty">
          <ScrollText className="w-6 h-6" />
          Audit yozuvlari topilmadi
        </div>
      ) : (
        <div className="admin-audit-list">
          {data.results.map((log) => (
            <div key={log.id} className="admin-audit-item">
              <div className="admin-audit-avatar">{log.admin_name.charAt(0).toUpperCase()}</div>
              <div className="admin-audit-body">
                <div className="admin-audit-action">
                  <strong>{log.admin_name}</strong> — {log.action}
                </div>
                {log.details && <div className="admin-audit-details">{log.details}</div>}
              </div>
              <div className="admin-audit-time">
                {new Date(log.created_at).toLocaleString('uz-UZ', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}