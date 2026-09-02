import { useEffect, useState } from 'react';
import { Loader2, Save, Wrench, ToggleLeft, Plug, ShieldAlert } from 'lucide-react';
import { api, type SiteSettingsData } from '../../../api/client';
import { useApp } from '../../../context/AppContext';

export function AdminSettingsPage() {
  const { showToast } = useApp();
  const [settings, setSettings] = useState<SiteSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .siteAdminSettings()
      .then(setSettings)
      .catch(() => showToast('Sozlamalarni yuklashda xatolik', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return <div className="admin-loading"><Loader2 className="w-6 h-6 admin-spin" /> Yuklanmoqda...</div>;
  }
  if (!settings) return <div className="admin-error">Ma'lumot topilmadi</div>;

  const set = (key: keyof SiteSettingsData, val: unknown) => setSettings({ ...settings, [key]: val });

  const save = async () => {
    setSaving(true);
    try {
      await api.siteAdminUpdateSettings({
        site_name: settings.site_name,
        tagline: settings.tagline,
        contact_phone: settings.contact_phone,
        contact_email: settings.contact_email,
        maintenance_mode: settings.maintenance_mode,
        allow_new_projects: settings.allow_new_projects,
        allow_reviews: settings.allow_reviews,
        allow_ai_chat: settings.allow_ai_chat,
        allow_store: settings.allow_store,
        store_api_url: settings.store_api_url,
      });
      showToast('Sozlamalar saqlandi');
    } catch {
      showToast('Saqlashda xatolik', 'error');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="admin-toggle-row">
      <div className="admin-toggle-info">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
      <button
        className={`admin-switch${value ? ' is-on' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <span className="admin-switch-thumb" />
      </button>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Sayt sozlamalari</h1>
        <p>Umumiy va funksional sozlamalar</p>
      </div>

      <div className="admin-settings-layout">
        <div className="admin-settings-main">
          <div className="admin-card">
            <div className="admin-card-head"><h2><Wrench className="w-4 h-4" /> Umumiy</h2></div>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Sayt nomi</span>
                <input className="control" value={settings.site_name} onChange={(e) => set('site_name', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Tagline</span>
                <input className="control" value={settings.tagline} onChange={(e) => set('tagline', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Bog'lanish telefoni</span>
                <input className="control" type="tel" value={settings.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Email</span>
                <input className="control" type="email" value={settings.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-head"><h2><ToggleLeft className="w-4 h-4" /> Xususiyatlar</h2></div>
            <Toggle
              label="Yangi loyiha qabul qilish"
              desc="Yangi loyiha yuborishlarini yoqish/o'chirish"
              value={settings.allow_new_projects}
              onChange={(v) => set('allow_new_projects', v)}
            />
            <Toggle
              label="Sharhlar"
              desc="Sharhlash imkoniyatini yoqish/o'chirish"
              value={settings.allow_reviews}
              onChange={(v) => set('allow_reviews', v)}
            />
            <Toggle
              label="AI Chat"
              desc="AI yordamchini yoqish/o'chirish"
              value={settings.allow_ai_chat}
              onChange={(v) => set('allow_ai_chat', v)}
            />
            <Toggle
              label="Do'kon"
              desc="Do'kon bo'limini yoqish/o'chirish"
              value={settings.allow_store}
              onChange={(v) => set('allow_store', v)}
            />
          </div>

          <div className="admin-card">
            <div className="admin-card-head"><h2><Plug className="w-4 h-4" /> Integratsiyalar</h2></div>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Do'kon API URL</span>
                <input className="control" value={settings.store_api_url} onChange={(e) => set('store_api_url', e.target.value)} />
              </label>
              <div className="admin-field">
                <span>Do'kon API kaliti</span>
                <div className="admin-key-status">{settings.store_api_key ? 'O\'rnatilgan' : 'O\'rnatilmagan'}</div>
              </div>
              <div className="admin-field">
                <span>Anthropic API kaliti</span>
                <div className="admin-key-status">{settings.anthropic_api_key ? 'O\'rnatilgan' : 'O\'rnatilmagan'}</div>
              </div>
            </div>
          </div>
        </div>

        <aside className="admin-settings-side">
          <div className="admin-card">
            <div className="admin-card-head"><h2><ShieldAlert className="w-4 h-4" /> Texnik xizmat</h2></div>
            <Toggle
              label="Texnik xizmat rejimi"
              desc="Foydalanuvchilarga banner ko'rsatiladi, admin ishlaydi"
              value={settings.maintenance_mode}
              onChange={(v) => set('maintenance_mode', v)}
            />
          </div>
          <button className="btn btn-primary admin-save-btn" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 admin-spin" /> : <Save className="w-4 h-4" />} Saqlash
          </button>
        </aside>
      </div>
    </div>
  );
}
