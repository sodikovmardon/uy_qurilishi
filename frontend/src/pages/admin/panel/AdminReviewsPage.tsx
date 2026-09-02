import { useEffect, useState } from 'react';
import { Search, Loader2, MessageSquare } from 'lucide-react';
import { api } from '../../../api/client';
import { useApp } from '../../../context/AppContext';

export function AdminReviewsPage() {
  const { showToast } = useApp();
  const [data, setData] = useState<{ total: number; results: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .siteAdminReviews()
      .then(setData)
      .catch(() => showToast('Sharhlarni yuklashda xatolik', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Sharhlar</h1>
        <p>Barcha sharhlarni moderatsiya qilish</p>
      </div>

      <div className="admin-table-toolbar">
        <div className="admin-search">
          <Search className="w-4 h-4 admin-search-icon" />
          <input className="admin-search-input" placeholder="Qidirish..." />
        </div>
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 className="w-6 h-6 admin-spin" /> Yuklanmoqda...</div>
      ) : !data || data.results.length === 0 ? (
        <div className="admin-empty">
          <MessageSquare className="w-6 h-6" />
          Hozircha sharhlar mavjud emas. Sharh modeli faollashtirilgach, bu yerda paydo bo'ladi.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sharhlovchi</th>
                <th>Ob'ekt</th>
                <th>Baholash</th>
                <th>Matn</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
                <tr key={i}>
                  <td>{String((r as Record<string, unknown>).reviewer ?? '—')}</td>
                  <td>{String((r as Record<string, unknown>).item ?? '—')}</td>
                  <td>{String((r as Record<string, unknown>).rating ?? '—')}</td>
                  <td>{String((r as Record<string, unknown>).comment ?? '—')}</td>
                  <td>{String((r as Record<string, unknown>).date ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
