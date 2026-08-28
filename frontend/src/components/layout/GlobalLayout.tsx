import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Navbar } from '../ui/Navbar';
import { BottomNav } from './BottomNav';
import { ProgressBar } from '../ui/ProgressBar';
import { STORE_URL } from '../../config/links';

interface GlobalLayoutProps {
  children: ReactNode;
  onAuthOpen: () => void;
  user?: { id: number; name: string; phone: string } | null;
  onLogout?: () => void;
}

/**
 * Global app shell — sticky glass header + centered content container + footer.
 * The header strengthens its blur/background once the page is scrolled.
 */
export function GlobalLayout({ children, onAuthOpen, user, onLogout }: GlobalLayoutProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="app-shell min-h-screen flex flex-col transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <ProgressBar />
      <motion.header
        className={`app-header${scrolled ? ' is-scrolled' : ''}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Navbar onAuthOpen={onAuthOpen} user={user} onLogout={onLogout} />
      </motion.header>

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-[96px] md:pb-8">
        {children}
      </main>

      <BottomNav />

      <footer
        className="py-6 text-center text-xs border-t"
        style={{
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-card)',
        }}
      >
        <nav className="footer-links" aria-label="Sahifa havolalari">
          <Link to="/">Bosh sahifa</Link>
          <Link to="/kalkulyator">Kalkulyator</Link>
          <Link to="/loyihalar">Loyihalar</Link>
          <a href={STORE_URL}>Do'kon</a>
          <Link to="/yangi-loyiha">Yangi loyiha</Link>
          <Link to="/qurilish">Qurilish jarayoni</Link>
          <Link to="/profil">Profil</Link>
        </nav>
        <p className="mt-3">
          Hamkorimiz —{' '}
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="partner-link"
          >
            Qurilish Bazasi
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </p>
        <p className="mt-2">Uy Loyiha Studio &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
