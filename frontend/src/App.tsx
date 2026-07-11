import { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { GlobalLayout } from './components/layout/GlobalLayout';
import { AuthModal } from './components/auth/AuthModal';
import { HomePage } from './pages/HomePage';
import type { NavLink } from './types';

function AppContent() {
  const [activePage, setActivePage] = useState<NavLink['id']>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleNavigate = useCallback((page: NavLink['id']) => {
    setActivePage(page);
  }, []);

  function renderPage() {
    switch (activePage) {
      case 'home':
        return <HomePage />;
      case 'projects':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Loyihalar</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Bu yerda loyihalaringiz ro'yxati ko'rinadi</p>
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
    <GlobalLayout activePage={activePage} onNavigate={handleNavigate} onAuthOpen={() => setIsAuthOpen(true)}>
      {renderPage()}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
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
