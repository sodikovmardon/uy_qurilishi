import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  LayoutDashboard,
  FolderKanban,
  Users,
  MessageSquare,
  Tags,
  Settings,
  ScrollText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api, type SiteAdminStatus, type SiteAdminNotification } from '../../../api/client';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';

interface AdminLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/admin', label: 'Boshqaruv paneli', icon: LayoutDashboard, end: true },
  { to: '/admin/loyihalar', label: 'Loyihalar', icon: FolderKanban },
  { to: '/admin/foydalanuvchilar', label: 'Foydalanuvchilar', icon: Users },
  { to: '/admin/sharhlar', label: 'Sharhlar', icon: MessageSquare },
  { to: '/admin/kategoriyalar', label: 'Kategoriyalar', icon: Tags },
  { to: '/admin/sozlamalar', label: 'Sozlamalar', icon: Settings },
  { to: '/admin/audit', label: 'Audit jurnali', icon: ScrollText },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<SiteAdminStatus['user'] | null>(null);
  const [notifications, setNotifications] = useState<SiteAdminNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    api.adminStatus().then((data) => setMe(data.user));
    api
      .siteAdminNotifications()
      .then((data) => setNotifications(data.results))
      .catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const openNotif = async () => {
    setNotifOpen((v) => !v);
    if (!notifOpen) {
      const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (ids.length) {
        try {
          await api.siteAdminMarkNotificationsRead(ids);
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch {
          /* ignore */
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    navigate('/');
  };

  const sidebarContent = (
    <>
      <Link to="/admin" className="admin-brand" onClick={() => setMobileOpen(false)}>
        <span className="admin-brand-badge">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <span className="admin-brand-text">
          <strong>Uy Loyiha</strong>
          <small>Admin paneli</small>
        </span>
      </Link>

      <nav className="admin-nav" aria-label="Admin panel navigatsiyasi">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-item${isActive ? ' is-active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="admin-nav-icon" />
              <span className="admin-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="admin-nav-footer">
        <a href="/" className="admin-nav-item" onClick={() => setMobileOpen(false)}>
          <ExternalLink className="admin-nav-icon" />
          <span className="admin-nav-label">Saytga qaytish</span>
        </a>
        <button className="admin-nav-item admin-nav-logout" onClick={handleLogout}>
          <LogOut className="admin-nav-icon" />
          <span className="admin-nav-label">Chiqish</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="admin-shell">
      {/* Desktop sidebar */}
      <aside className={`admin-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        {sidebarContent}
        <button
          className="admin-collapse-btn"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Menyuni ochish' : 'Menyuni yopish'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && <div className="admin-mobile-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar admin-sidebar-mobile${mobileOpen ? ' is-open' : ''}`}>
        {sidebarContent}
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-mobile-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Menyuni ochish"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="admin-topbar-title">Uy Loyiha Studio — Boshqaruv</div>

          <div className="admin-topbar-actions">
            <ThemeToggle />
            <div className="admin-notif-wrap">
              <button
                className="admin-icon-btn"
                onClick={openNotif}
                aria-label="Bildirishnomalar"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="admin-notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="admin-notif-dropdown">
                  <div className="admin-notif-header">Bildirishnomalar</div>
                  {notifications.length === 0 ? (
                    <div className="admin-notif-empty">Bildirishnomalar yo&apos;q</div>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className={`admin-notif-item${n.is_read ? ' is-read' : ''}`}>
                        <span className="admin-notif-title">{n.title}</span>
                        <span className="admin-notif-time">
                          {new Date(n.created_at).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="admin-user-chip">
              {me ? (
                <>
                  <span className="admin-user-avatar">{me.name.charAt(0).toUpperCase()}</span>
                  <span className="admin-user-name">{me.name}</span>
                </>
              ) : (
                <span className="admin-user-name">Admin</span>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
