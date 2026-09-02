import { useEffect, useState } from 'react';
import { Tags, MapPin, Loader2 } from 'lucide-react';
import { api } from '../../../api/client';
import { useApp } from '../../../context/AppContext';

export function AdminCategoriesPage() {
  const { showToast } = useApp();
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [regions, setRegions] = useState<{ name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.siteAdminCategories(), api.siteAdminRegions()])
      .then(([c, r]) => {
        setCategories(c.results);
        setRegions(r.results);
      })
      .catch(() => showToast('Yuklashda xatolik', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return <div className="admin-loading"><Loader2 className="w-6 h-6 admin-spin" /> Yuklanmoqda...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Kategoriyalar va Mintaqalar</h1>
        <p>Mahsulot kategoriyalari va hududiy ma'lumotlar</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <h2><Tags className="w-4 h-4" /> Mahsulot kategoriyalari</h2>
        </div>
        <div className="admin-cat-grid">
          {categories.map((c) => (
            <div key={c.name} className="admin-cat-item">
              <span>{c.name}</span>
              <span className="admin-tag">{c.count} dona</span>
            </div>
          ))}
        </div>
        {categories.length === 0 && <div className="admin-empty-inline">Kategoriyalar topilmadi</div>}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <h2><MapPin className="w-4 h-4" /> Mintaqalar</h2>
        </div>
        <div className="admin-cat-grid">
          {regions.map((r) => (
            <div key={r.code} className="admin-cat-item">
              <span>{r.name}</span>
              <span className="admin-tag">{r.code}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
