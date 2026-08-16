import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { ChatProvider } from './context/ChatContext';
import { ChatFab } from './components/chat/ChatFab';
import { ChatPanel } from './components/chat/ChatPanel';
import { GlobalLayout } from './components/layout/GlobalLayout';
import { AuthModal } from './components/auth/AuthModal';
import { HomePage } from './pages/HomePage';
import { CalculatorPage } from './pages/CalculatorPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ConstructionPage } from './pages/ConstructionPage';
import { ConstructionDetailPage } from './pages/ConstructionDetailPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import { DokonPage } from './pages/shop/DokonPage';
import { ApiDocsPage } from './pages/shop/ApiDocsPage';
import { AdminPage } from './pages/admin/AdminPage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { api } from './api/client';
import { t } from './lib/i18n';
import { getFontSize, type FontSize } from './lib/storage';
import { finishProgress, startProgress } from './lib/progress';

interface User {
  id: number;
  name: string;
  phone: string;
}

const FONT_SIZES: Record<FontSize, string> = { small: '15px', medium: '', large: '17.5px' };

/** Back-compat: the old /do-kon(/…​) storefront routes now live at /dokon. */
function RedirectToDokon() {
  const { id } = useParams();
  return <Navigate to={id ? `/dokon?product=${id}` : '/dokon'} replace />;
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const { showToast } = useApp();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.authStatus().then((data) => {
      if (data.authenticated && data.user) setUser(data.user);
    });
  }, []);

  // Apply persisted font-size preference to the app root on load.
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[getFontSize()] || '';
  }, []);

  // Perceived-performance progress bar + reset scroll on every route change.
  useEffect(() => {
    startProgress();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const timer = window.setTimeout(finishProgress, 400);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // session already gone — clear the local user anyway
    }
    setUser(null);
    navigate('/');
    showToast(t('nav.loggedOut'));
  }, [navigate, showToast]);

  return (
    <ChatProvider>
      <GlobalLayout onAuthOpen={() => setIsAuthOpen(true)} user={user} onLogout={handleLogout}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/kalkulyator" element={<CalculatorPage />} />
              <Route path="/loyihalar" element={<ProjectsPage />} />
              <Route path="/loyihalar/:id" element={<ProjectDetailPage />} />
              <Route path="/yangi-loyiha" element={<NewProjectPage />} />
              <Route path="/sevimlilar" element={<FavoritesPage />} />
              <Route
                path="/profil"
                element={<ProfilePage user={user} onAuthOpen={() => setIsAuthOpen(true)} onLogout={handleLogout} />}
              />
              <Route path="/sozlamalar" element={<SettingsPage onLogout={handleLogout} />} />
              <Route path="/qurilish" element={<ConstructionPage />} />
              <Route path="/qurilish/:id" element={<ConstructionDetailPage />} />
              <Route path="/dokon" element={<DokonPage />} />
              <Route path="/do-kon" element={<RedirectToDokon />} />
              <Route path="/do-kon/:id" element={<RedirectToDokon />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/boshqaruv" element={<AdminPage />} />
              <Route path="/boshqaruv/mahsulotlar" element={<AdminPage />} />
              <Route path="/boshqaruv/narxlar" element={<AdminPage />} />
              <Route path="/boshqaruv/buyurtmalar" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={(u) => setUser(u)}
        />
      </GlobalLayout>

      <ChatFab />
      <ChatPanel />
    </ChatProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
