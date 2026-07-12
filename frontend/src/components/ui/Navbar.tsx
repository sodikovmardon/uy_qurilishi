import { motion } from 'framer-motion';
import { LogIn, LogOut, HardHat, User } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { NavLink } from '../../types';

const links: NavLink[] = [
  { id: 'home', label: 'Bosh sahifa' },
  { id: 'projects', label: 'Loyihalar' },
  { id: 'new-project', label: 'Yangi loyiha' },
];

interface NavbarProps {
  active: string;
  onNavigate: (id: NavLink['id']) => void;
  onAuthOpen: () => void;
  user?: { id: number; name: string; phone: string } | null;
  onLogout?: () => void;
}

export function Navbar({ active, onNavigate, onAuthOpen, user, onLogout }: NavbarProps) {
  return (
    <nav
      className="flex items-center justify-between px-6 py-2 border-b border-[var(--border-card)]"
      style={{ backgroundColor: 'var(--bg-panel)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-center gap-8">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#007AFF] to-[#0051A8] flex items-center justify-center">
            <HardHat className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Uy Loyiha
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = active === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className="relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{ backgroundColor: 'var(--hover-overlay)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-sm hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
              <User className="w-3.5 h-3.5 inline mr-1" />
              {user.name}
            </span>
            <motion.button
              onClick={onLogout}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-card)',
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Chiqish</span>
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={onAuthOpen}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium bg-[#007AFF] text-white hover:bg-[#0051A8] transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Kirish
          </motion.button>
        )}
      </div>
    </nav>
  );
}
