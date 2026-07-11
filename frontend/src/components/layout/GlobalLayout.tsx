import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrafficLights } from '../ui/TrafficLights';
import { Navbar } from '../ui/Navbar';
import type { NavLink } from '../../types';

interface GlobalLayoutProps {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: NavLink['id']) => void;
  onAuthOpen: () => void;
}

export function GlobalLayout({ children, activePage, onNavigate, onAuthOpen }: GlobalLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <motion.header
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: 'var(--bg-panel)',
          backdropFilter: 'blur(30px)',
          borderColor: 'var(--border-panel)',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <TrafficLights />
        <Navbar active={activePage} onNavigate={onNavigate} onAuthOpen={onAuthOpen} />
      </motion.header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
        {children}
      </main>

      <footer
        className="py-6 text-center text-xs border-t"
        style={{
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-card)',
        }}
      >
        Uy Loyiha Studio &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
