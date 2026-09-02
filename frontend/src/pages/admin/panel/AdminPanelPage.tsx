import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../../api/client';
import { AdminLayout } from './AdminLayout';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminProjectsPage } from './AdminProjectsPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminReviewsPage } from './AdminReviewsPage';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminAuditPage } from './AdminAuditPage';

/**
 * Admin Panel root. Verifies admin access server-side via /site-admin/auth/status/.
 * Non-admins are silently redirected to the homepage (no access-denied leak).
 */
export default function AdminPanelPage() {
  const [state, setState] = useState<'checking' | 'admin' | 'not-admin'>('checking');

  useEffect(() => {
    let active = true;
    api
      .adminStatus()
      .then((data) => {
        if (!active) return;
        setState(data.authenticated && data.is_admin ? 'admin' : 'not-admin');
      })
      .catch(() => {
        if (active) setState('not-admin');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'checking') {
    return (
      <div className="admin-shell">
        <div className="admin-loading admin-loading-full">
          <Loader2 className="w-6 h-6 admin-spin" />
          Tekshirilmoqda...
        </div>
      </div>
    );
  }

  // Security: behave as if the route doesn't exist for non-admins.
  if (state === 'not-admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route index element={<AdminDashboardPage />} />
        <Route path="loyihalar" element={<AdminProjectsPage />} />
        <Route path="foydalanuvchilar" element={<AdminUsersPage />} />
        <Route path="sharhlar" element={<AdminReviewsPage />} />
        <Route path="kategoriyalar" element={<AdminCategoriesPage />} />
        <Route path="sozlamalar" element={<AdminSettingsPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}