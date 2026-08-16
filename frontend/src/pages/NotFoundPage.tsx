import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { FavoritesEmpty } from '../components/ui/EmptyIllustration';

/** Friendly 404 — rendered inside GlobalLayout so the header/nav stay visible. */
export function NotFoundPage() {
  return (
    <div className="card-surface fade-in flex flex-col items-center justify-center gap-5 py-20 px-4 text-center">
      <FavoritesEmpty size={150} />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Sahifa topilmadi
        </h1>
        <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Bu manzilda hech narsa yo’q — loyiha o’chirilgan yoki havola noto’g’ri bo’lishi mumkin.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="btn btn-primary">
          Bosh sahifaga qaytish
        </Link>
        <Link to="/loyihalar" className="btn btn-secondary">
          <Compass className="w-4 h-4" />
          Loyihalarni ko’rish
        </Link>
      </div>
    </div>
  );
}
