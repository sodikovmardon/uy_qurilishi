import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Calculator, Home, LayoutGrid, Store, User } from 'lucide-react';
import { t } from '../../lib/i18n';
import { STORE_URL } from '../../config/links';

interface TabDef {
  to?: string;
  href?: string;
  label: string;
  ariaLabel: string;
  icon: typeof Home;
  end?: boolean;
  fab?: boolean;
}

const TABS: TabDef[] = [
  { to: '/', label: t('nav.home'), ariaLabel: 'Bosh sahifaga o’tish', icon: Home, end: true },
  { to: '/loyihalar', label: t('nav.projects'), ariaLabel: 'Loyihalarga o’tish', icon: LayoutGrid },
  { to: '/kalkulyator', label: t('nav.calculator'), ariaLabel: 'Kalkulyatorga o’tish', icon: Calculator, end: true, fab: true },
  { href: STORE_URL, label: t('nav.store'), ariaLabel: 'Do’konga o’tish', icon: Store },
  { to: '/profil', label: t('nav.menu.profile'), ariaLabel: 'Profilga o’tish', icon: User, end: true },
];

/**
 * Mobile bottom tab bar (<768px) — Instagram-style navigation.
 * Hidden on desktop and automatically slid away while any modal is open.
 */
export function BottomNav() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onModal = (e: Event) => setHidden((e as CustomEvent<boolean>).detail);
    window.addEventListener('ui:modal', onModal);
    return () => window.removeEventListener('ui:modal', onModal);
  }, []);

  return (
    <nav className={`bottom-nav${hidden ? ' is-hidden' : ''}`} aria-label="Asosiy navigatsiya">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const className = ({ isActive }: { isActive: boolean }) =>
          `${tab.fab ? 'bottom-fab' : 'bottom-tab'}${isActive ? ' is-active' : ''}`;
        if (tab.href) {
          return (
            <a key={tab.href} href={tab.href} className="bottom-tab" aria-label={tab.ariaLabel}>
              <Icon className="bottom-tab-icon" aria-hidden="true" />
              <span className="bottom-tab-label">{tab.label}</span>
            </a>
          );
        }
        return (
          <NavLink key={tab.to} to={tab.to!} end={tab.end} className={className} aria-label={tab.ariaLabel}>
            {tab.fab ? (
              <span className="bottom-fab-circle">
                <Icon className="bottom-fab-icon" aria-hidden="true" />
              </span>
            ) : (
              <Icon className="bottom-tab-icon" aria-hidden="true" />
            )}
            <span className="bottom-tab-label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
