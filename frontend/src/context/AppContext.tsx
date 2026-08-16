import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { clearFavorites as clearStoredFavorites, getFavorites, isFavorite, toggleFavorite } from '../lib/storage';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  leaving: boolean;
}

interface AppContextValue {
  /** Centralized toast notifications — the single entry point for the whole app. */
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  dismissToast: (id: number) => void;
  favorites: Record<string, string>;
  toggleFav: (projectId: string) => boolean;
  favOf: (projectId: string) => boolean;
  /** Clear stored + in-memory favorites (used by "clear all local data"). */
  clearFavs: () => void;
}

const TOAST_LEAVE_MS = 300;

const TOAST_ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [favorites, setFavorites] = useState<Record<string, string>>(getFavorites);
  const idRef = useRef(0);

  // Mark a toast as leaving (triggers slide-out animation), then remove it.
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_LEAVE_MS);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'success', durationMs = 3000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, kind, message, leaving: false }]);
      if (durationMs > 0) window.setTimeout(() => dismissToast(id), durationMs);
    },
    [dismissToast],
  );

  const toggleFav = useCallback((projectId: string) => {
    const nowFav = toggleFavorite(projectId);
    setFavorites(getFavorites());
    return nowFav;
  }, []);

  const favOf = useCallback((projectId: string) => isFavorite(projectId), [favorites]);

  const clearFavs = useCallback(() => {
    clearStoredFavorites();
    setFavorites({});
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast, favorites, toggleFav, favOf, clearFavs }),
    [showToast, dismissToast, favorites, toggleFav, favOf, clearFavs],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.kind];
          return (
            <div key={t.id} className={`toast toast-${t.kind}${t.leaving ? ' is-leaving' : ''}`}>
              <Icon className="toast-icon" aria-hidden="true" />
              <span className="toast-msg">{t.message}</span>
              <button
                className="toast-close"
                type="button"
                aria-label="Yopish"
                onClick={() => dismissToast(t.id)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
