import { useState, useCallback, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { GlobalLayout } from './components/layout/GlobalLayout';
import { AuthModal } from './components/auth/AuthModal';
import { HomePage } from './pages/HomePage';
import type { NavLink } from './types';
import { api } from './api/client';

function AppContent() {
  const [activePage, setActivePage] = useState<NavLink['id']>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    api.authStatus().then(data => {
      if (data.authenticated && data.user) {
        setUser(data.user);
      }
    });
    api.getProjects(1).then(data => setProjects(data.results));
  }, []);

  const handleNavigate = useCallback((page: NavLink['id']) => {
    setActivePage(page);
    if (page === 'projects') {
      api.getProjects(1).then(data => setProjects(data.results));
    }
  }, []);

  function renderPage() {
    switch (activePage) {
      case 'home':
        return <HomePage />;
      case 'projects':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Loyihalar</h2>
            {projects.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Hozircha loyihalar yo'q</p>
            ) : (
              <div className="grid gap-3 w-full max-w-lg">
                {projects.map((p: any) => (
                  <div key={p.id} className="rounded-xl p-4 border text-left" style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-card)',
                  }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      #{p.id} — {p.area} m², {p.rooms} xona
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {p.user_name || 'Anonim'} · {new Date(p.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'new-project':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Yangi loyiha</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Yangi loyiha yaratish formasi</p>
          </div>
        );
    }
  }

  return (
    <GlobalLayout
      activePage={activePage}
      onNavigate={handleNavigate}
      onAuthOpen={() => setIsAuthOpen(true)}
      user={user}
      onLogout={async () => {
        await api.logout();
        setUser(null);
      }}
    >
      {renderPage()}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </GlobalLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
