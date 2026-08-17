import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Calculator,
  HardHat,
  Heart,
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShoppingBag,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { t } from '../../lib/i18n';
import { STORE_URL } from '../../config/links';

interface User {
  id: number;
  name: string;
  phone: string;
}

interface NavbarProps {
  onAuthOpen: () => void;
  user?: User | null;
  onLogout?: () => void;
}

function HouseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const NAV_LINKS: {
  to?: string;
  href?: string;
  label: string;
  end?: boolean;
  icon: typeof Home;
  badge?: string;
}[] = [
  { to: '/', label: t('nav.home'), icon: Home, end: true },
  { to: '/kalkulyator', label: t('nav.calculator'), icon: Calculator, end: true },
  { to: '/loyihalar', label: t('nav.projects'), icon: LayoutGrid },
  { href: STORE_URL, label: t('nav.store'), icon: ShoppingBag, badge: 'Qurilish Bazasi' },
  { to: '/yangi-loyiha', label: t('nav.new'), icon: Plus, end: true },
];

function NavLinks({ onPick }: { onPick?: () => void }) {
  return (
    <>
      {NAV_LINKS.map((link) => {
        const Icon = link.icon;
        if (link.href) {
          return (
            <a
              key={link.href}
              href={link.href}
              onClick={onPick}
              className="nav-link store-link"
            >
              <Icon className="nav-link-icon" />
              <span>{link.label}</span>
              {link.badge && <span className="store-badge">{link.badge}</span>}
            </a>
          );
        }
        return (
          <NavLink
            key={link.to}
            to={link.to!}
            end={link.end}
            onClick={onPick}
            className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
          >
            <Icon className="nav-link-icon" />
            <span>{link.label}</span>
          </NavLink>
        );
      })}
    </>
  );
}

interface UserMenuProps {
  user: User;
  logoutConfirm: boolean;
  onConfirmStart: () => void;
  onConfirmCancel: () => void;
  onLogout: () => void;
}

function UserMenu({ user, logoutConfirm, onConfirmStart, onConfirmCancel, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((v) => !v);
    if (open) onConfirmCancel();
  };

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-menu-trigger"
        aria-label={`${user.name} — profil menyusi`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="user-avatar">{initials(user.name)}</span>
        <span className="user-menu-name">{user.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 user-chevron${open ? ' is-open' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="user-dropdown"
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="dropdown-header">
              <span className="user-avatar user-avatar-lg">{initials(user.name)}</span>
              <div>
                <p className="dropdown-user-name">{user.name}</p>
                <p className="dropdown-user-phone">{user.phone}</p>
              </div>
            </div>
            <div className="dropdown-divider" role="separator" />
            {logoutConfirm ? (
              <div className="dropdown-confirm" role="alert">
                <p>{t('nav.menu.logoutConfirm')}</p>
                <div className="dropdown-confirm-actions">
                  <button className="btn btn-danger btn-sm" onClick={onLogout}>
                    {t('nav.menu.logoutYes')}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={onConfirmCancel}>
                    {t('nav.menu.logoutNo')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link to="/profil" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                  <UserIcon className="w-4 h-4" aria-hidden="true" />
                  {t('nav.menu.profile')}
                </Link>
                <Link to="/sevimlilar" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                  <Heart className="w-4 h-4" aria-hidden="true" />
                  {t('nav.favorites')}
                </Link>
                <Link to="/yangi-loyiha" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  {t('nav.new')}
                </Link>
                <Link to="/qurilish" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                  <HardHat className="w-4 h-4" aria-hidden="true" />
                  {t('nav.menu.progress')}
                </Link>
                <Link to="/kalkulyator?byudjet=1" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                  <Wallet className="w-4 h-4" aria-hidden="true" />
                  Byudjet rejalashtiruvchi
                </Link>
                <div className="dropdown-divider" role="separator" />
                <Link to="/sozlamalar" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  {t('nav.menu.settings')}
                </Link>
                <div className="dropdown-divider" role="separator" />
                <button className="dropdown-item dropdown-item-danger" role="menuitem" onClick={onConfirmStart}>
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  {t('nav.signout')}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar({ onAuthOpen, user, onLogout }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setLogoutConfirm(false);
    setMenuOpen(false);
    onLogout?.();
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" aria-label={t('nav.home')}>
        <span className="brand-icon">
          <HouseIcon />
        </span>
        <span className="brand-text">Uy Loyiha Studio</span>
      </Link>

      <div className="nav-links">
        <NavLinks />
      </div>

      <div className="nav-actions">
        <ThemeToggle />

        {user ? (
          <UserMenu
            user={user}
            logoutConfirm={logoutConfirm}
            onConfirmStart={() => setLogoutConfirm(true)}
            onConfirmCancel={() => setLogoutConfirm(false)}
            onLogout={handleLogout}
          />
        ) : (
          <button onClick={onAuthOpen} className="signin-btn">
            <LogIn className="w-4 h-4" />
            {t('nav.signin')}
          </button>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="hamburger"
          aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
          aria-expanded={menuOpen}
          aria-controls="mobile-drawer"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && <div className="mobile-backdrop" onClick={() => setMenuOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        <motion.aside
          id="mobile-drawer"
          className="mobile-drawer"
          initial={{ x: '100%' }}
          animate={{ x: menuOpen ? 0 : '100%' }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          aria-hidden={!menuOpen}
        >
          {user && (
            <div className="drawer-user">
              <span className="user-avatar user-avatar-lg">{initials(user.name)}</span>
              <div>
                <p className="drawer-user-name">{user.name}</p>
                <p className="drawer-user-phone">{user.phone}</p>
              </div>
            </div>
          )}

          <div className="drawer-links">
            <NavLinks onPick={() => setMenuOpen(false)} />
          </div>

          <div className="drawer-divider" />

          <div className="drawer-actions">
            {user ? (
              <>
                <Link to="/profil" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <UserIcon className="w-4 h-4" aria-hidden="true" />
                  {t('nav.menu.profile')}
                </Link>
                <Link to="/sevimlilar" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <Heart className="w-4 h-4" aria-hidden="true" />
                  {t('nav.favorites')}
                </Link>
                <Link to="/yangi-loyiha" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  {t('nav.new')}
                </Link>
                <Link to="/qurilish" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <HardHat className="w-4 h-4" aria-hidden="true" />
                  {t('nav.menu.progress')}
                </Link>
                <Link to="/kalkulyator?byudjet=1" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <Wallet className="w-4 h-4" aria-hidden="true" />
                  Byudjet rejalashtiruvchi
                </Link>
                <Link to="/sozlamalar" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  {t('nav.menu.settings')}
                </Link>

                <div className="drawer-divider" />

                {logoutConfirm ? (
                  <div className="dropdown-confirm" role="alert">
                    <p>{t('nav.menu.logoutConfirm')}</p>
                    <div className="dropdown-confirm-actions">
                      <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                        {t('nav.menu.logoutYes')}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setLogoutConfirm(false)}>
                        {t('nav.menu.logoutNo')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="dropdown-item dropdown-item-danger" onClick={setLogoutConfirm.bind(null, true)}>
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    {t('nav.signout')}
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  onAuthOpen();
                  setMenuOpen(false);
                }}
                className="signin-btn signin-btn-full"
              >
                <LogIn className="w-4 h-4" />
                {t('nav.signin')}
              </button>
            )}
          </div>
        </motion.aside>
      </AnimatePresence>
    </nav>
  );
}
