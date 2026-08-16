import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Camera,
  HardHat,
  Heart,
  History,
  LogOut,
  Settings2,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import {
  deleteCalculation,
  getAvatar,
  getHistory,
  getProfile,
  saveAvatar,
  saveProfile,
} from '../lib/storage';
import { DEFAULT_REGION_ID, REGIONS } from '../config/regions';
import { formatUZS, getBrickType } from '../lib/calculator';
import { FavoritesPage } from './FavoritesPage';
import { MySubmissions } from '../components/profile/MySubmissions';
import { ConstructionList } from '../components/construction/ConstructionList';
import { StartConstructionModal } from '../components/construction/StartConstructionModal';
import { weightsFromSavedCalc } from '../lib/construction';

interface ProfilePageProps {
  user?: { id: number; name: string; phone: string } | null;
  onAuthOpen?: () => void;
  onLogout?: () => void;
}

type ProfileTab = 'hisoblar' | 'sevimlilar' | 'loyihalarim' | 'qurilish' | 'sozlamalar';

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'hisoblar', label: t('profile.tabCalcs') },
  { id: 'sevimlilar', label: t('profile.tabFavs') },
  { id: 'loyihalarim', label: 'Mening loyihalarim' },
  { id: 'qurilish', label: 'Mening qurilishim' },
  { id: 'sozlamalar', label: t('profile.tabSettings') },
];

interface StartSource {
  defaultName: string;
  source: { type: 'calculation' | 'project' | 'budget'; id: string };
  weights: number[] | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

/** Format a raw string into a +998 XX XXX XX XX phone mask as the user types. */
function maskPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('8')) d = d.slice(1);
  if (!d.startsWith('998')) d = '998' + d;
  d = d.slice(0, 12);
  let out = '+' + d.slice(0, 3);
  const rest = d.slice(3);
  if (rest.length > 0) out += ' ' + rest.slice(0, 2);
  if (rest.length > 2) out += ' ' + rest.slice(2, 5);
  if (rest.length > 5) out += ' ' + rest.slice(5, 7);
  if (rest.length > 7) out += ' ' + rest.slice(7, 9);
  return out;
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length === 12;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ProfilePage({ user, onAuthOpen, onLogout }: ProfilePageProps) {
  const { favorites, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = params.get('tab') as ProfileTab | null;
  const activeTab: ProfileTab = TABS.some((tb) => tb.id === tabParam) ? tabParam! : 'hisoblar';

  const stored = getProfile();
  const defaultRegion = DEFAULT_REGION_ID;
  const [saved, setSaved] = useState<UserProfileShape>({
    name: stored?.name || user?.name || '',
    phone: stored?.phone || user?.phone || '',
    email: stored?.email || '',
    region: stored?.region || defaultRegion,
    createdAt: stored?.createdAt,
  });
  const [form, setForm] = useState<UserProfileShape>({ ...saved });
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(getAvatar());
  const [historyTick, setHistoryTick] = useState(0);
  const [startSource, setStartSource] = useState<StartSource | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Merge server user into the form once auth resolves (fills first-time values).
  useEffect(() => {
    if (!user) return;
    setSaved((prev) => ({
      ...prev,
      name: prev.name || user.name,
      phone: prev.phone || user.phone,
    }));
    setForm((prev) => ({
      ...prev,
      name: prev.name || user.name,
      phone: prev.phone || user.phone,
    }));
  }, [user]);

  const isDirty = form.name !== saved.name || form.phone !== saved.phone || form.email !== saved.email || form.region !== saved.region;

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (form.name.trim().length < 2) errs.name = 'Ism kamida 2 belgi bo’lishi kerak';
    if (!isValidPhone(form.phone)) errs.phone = t('profile.phoneError');
    if (form.email.trim() && !isValidEmail(form.email.trim())) errs.email = t('profile.emailError');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const canSave = isDirty && validateFormSilent();

  function validateFormSilent(): boolean {
    const okName = form.name.trim().length >= 2;
    const okPhone = isValidPhone(form.phone);
    const okEmail = !form.email.trim() || isValidEmail(form.email.trim());
    return okName && okPhone && okEmail;
  }

  const enterEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => nameRef.current?.focus());
    document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = () => {
    if (!validate()) return;
    const next: UserProfileShape = { ...form, createdAt: saved.createdAt || new Date().toISOString() };
    saveProfile(next);
    setSaved(next);
    setEditing(false);
    showToast(t('profile.saved'));
  };

  const handleCancel = () => {
    setForm({ ...saved });
    setErrors({});
    setEditing(false);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      saveAvatar(dataUrl);
      setAvatar(dataUrl);
      showToast(t('profile.avatarUpdated'), 'info');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectTab = (id: ProfileTab) => {
    setParams(id === 'hisoblar' ? {} : { tab: id }, { replace: true });
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto w-full">
        <div className="card-surface" style={{ padding: 32 }}>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('profile.title')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.subtitle')}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 py-10 text-center">
            <UserIcon className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.notSignedIn')}
            </p>
            <button className="btn btn-primary" onClick={() => onAuthOpen?.()}>
              {t('profile.signInCta')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const secondaryLine = [form.phone, form.email].filter(Boolean).join(' · ') || user.phone;

  return (
    <div className="profile-layout w-full">
      {/* Left column — header + info form */}
      <div className="flex flex-col gap-6">
        <section className="card-surface profile-card">
          <div className="flex items-center gap-5">
            <div className="profile-avatar-wrap">
              <span className="profile-avatar">
                {avatar ? <img src={avatar} alt={saved.name || user.name} /> : initials(saved.name || user.name)}
              </span>
              <button
                type="button"
                className="profile-avatar-cam"
                aria-label="Rasmni yuklash"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-5 h-5" aria-hidden="true" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleAvatar}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {saved.name || user.name}
                </h1>
                <button className="btn btn-secondary btn-sm" onClick={enterEdit}>
                  {t('profile.edit')}
                </button>
              </div>
              <p className="mt-1 text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                {secondaryLine}
              </p>
              {saved.createdAt && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('profile.memberSince', formatSavedDate(saved.createdAt))}
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="profile-form" className="card-surface profile-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('profile.personalInfo')}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {t('profile.personalInfoSub')}
              </p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-name">{t('profile.fullName')}</label>
            <input
              id="profile-name"
              ref={nameRef}
              className={`control${editing ? '' : ' is-readonly'}`}
              value={form.name}
              disabled={!editing}
              placeholder="Abdulla Karimov"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          <div className="field">
            <label htmlFor="profile-phone">{t('profile.phone')}</label>
            <input
              id="profile-phone"
              className={`control${editing ? '' : ' is-readonly'}`}
              value={form.phone}
              disabled={!editing}
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
            />
            {errors.phone && <p className="error-text">{errors.phone}</p>}
          </div>

          <div className="field">
            <label htmlFor="profile-email">{t('profile.email')}</label>
            <input
              id="profile-email"
              className={`control${editing ? '' : ' is-readonly'}`}
              value={form.email}
              disabled={!editing}
              type="email"
              inputMode="email"
              placeholder="abdulla@example.com"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <p className="error-text">{errors.email}</p>}
          </div>

          <div className="field">
            <label htmlFor="profile-region">{t('profile.region')}</label>
            <select
              id="profile-region"
              className={`control${editing ? '' : ' is-readonly'}`}
              value={form.region}
              disabled={!editing}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            >
              <option value="" disabled>
                {t('profile.regionPlaceholder')}
              </option>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="profile-form-actions">
            <button className="btn btn-primary" disabled={!editing || !canSave} onClick={handleSave}>
              {t('profile.save')}
            </button>
            <button className="btn btn-secondary" disabled={!editing || !isDirty} onClick={handleCancel}>
              {t('profile.cancel')}
            </button>
          </div>
        </section>
      </div>

      {/* Right column — stats + tabs */}
      <div className="flex flex-col gap-6 min-w-0">
        <div className="stats-grid">
          <Link to="/profil?tab=hisoblar" className="stat-card no-underline">
            <span className="stat-icon" style={{ background: 'linear-gradient(135deg, #0A84FF, #0060DF)' }}>
              <History className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="stat-value">{getHistory().length}</span>
            <span className="stat-label">{t('profile.statCalcs')}</span>
          </Link>
          <Link to="/profil?tab=sevimlilar" className="stat-card no-underline">
            <span className="stat-icon" style={{ background: 'linear-gradient(135deg, #FF2D55, #AF52DE)' }}>
              <Heart className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="stat-value">{Object.keys(favorites).length}</span>
            <span className="stat-label">{t('profile.statFavs')}</span>
          </Link>
        </div>

        <div className="profile-tabs" role="tablist" aria-label="Profil bo’limlari">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`nav-link${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'hisoblar' && (
          <CalcsTab historyTick={historyTick} onChanged={() => setHistoryTick((x) => x + 1)} onStart={setStartSource} />
        )}
        {activeTab === 'sevimlilar' && <FavoritesPage embedded />}
        {activeTab === 'loyihalarim' && <MySubmissions tick={historyTick} onChanged={() => setHistoryTick((x) => x + 1)} />}
        {activeTab === 'qurilish' && <ConstructionList embedded />}
        {activeTab === 'sozlamalar' && (
          <div className="saved-empty">
            <span className="saved-empty-icon">
              <Settings2 className="w-5 h-5" aria-hidden="true" />
            </span>
            <p>{t('profile.settingsHint')}</p>
            <Link to="/sozlamalar" className="btn btn-primary">
              {t('profile.settingsOpen')}
            </Link>
          </div>
        )}

        <button className="btn btn-secondary w-full md:hidden" onClick={() => onLogout?.()}>
          <LogOut className="w-4 h-4" aria-hidden="true" />
          {t('profile.logout')}
        </button>
      </div>

      <StartConstructionModal
        open={!!startSource}
        defaultName={startSource?.defaultName}
        source={startSource?.source}
        weights={startSource?.weights}
        onClose={() => setStartSource(null)}
        onCreated={(p) => navigate(`/qurilish/${p.id}`)}
      />
    </div>
  );
}

interface UserProfileShape {
  name: string;
  phone: string;
  email: string;
  region: string;
  createdAt?: string;
}

/** "Mening hisoblarim" tab — saved calculations list with per-item delete + start tracker. */
function CalcsTab({
  historyTick,
  onChanged,
  onStart,
}: {
  historyTick: number;
  onChanged: () => void;
  onStart: (src: StartSource) => void;
}) {
  void historyTick;
  const history = getHistory();

  if (history.length === 0) {
    return (
      <div className="saved-empty">
        <span className="saved-empty-icon">
          <History className="w-5 h-5" aria-hidden="true" />
        </span>
        <p>{t('calc.historyEmpty')}</p>
        <Link to="/yangi-loyiha" className="btn btn-primary">
          {t('calc.historyEmptyCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="saved-grid">
      {history.map((h) => (
        <div key={h.id} className="saved-card">
          <div className="saved-card-head">
            <span className="saved-date">{formatSavedDate(h.createdAt)}</span>
            <button
              className="saved-trash"
              aria-label="O’chirish"
              onClick={() => {
                deleteCalculation(h.id);
                onChanged();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <span className="saved-spec">
            {getBrickType(h.brickId).label} · {h.wallLength}×{h.wallHeight} m · {h.rooms} xona
          </span>
          <span className="saved-total">{formatUZS(h.total)}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm w-full tracker-start-btn"
            onClick={() =>
              onStart({
                defaultName: `Mening uyim · ${h.wallLength}×${h.wallHeight} m, ${h.rooms} xona`,
                source: { type: 'calculation', id: h.id },
                weights: weightsFromSavedCalc(h),
              })
            }
          >
            <HardHat className="w-4 h-4" aria-hidden="true" />
            Qurilishni boshladim
          </button>
        </div>
      ))}
    </div>
  );
}
