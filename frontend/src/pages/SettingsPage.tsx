import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import Switch from '../components/ui/Switch';
import { t } from '../lib/i18n';
import { DEFAULT_REGION_ID, REGIONS } from '../config/regions';
import {
  clearAllLocalData,
  getCurrency,
  getDefaultRegion,
  getFavorites,
  getFontSize,
  getHistory,
  getLanguage,
  getNotifications,
  getPhoneVerified,
  resetMaterialPrices,
  saveCurrency,
  saveDefaultRegion,
  saveFontSize,
  saveLanguage,
  saveNotifications,
  savePhoneVerified,
  type CurrencyFormat,
  type FontSize,
  type NotificationsPrefs,
} from '../lib/storage';

interface SettingsPageProps {
  onLogout?: () => void;
}

const NOTIF_ROWS: { id: keyof NotificationsPrefs; label: string; desc: string }[] = [
  { id: 'newProjects', label: t('settings.notif.newProjects'), desc: t('settings.notif.newProjectsDesc') },
  { id: 'priceChanges', label: t('settings.notif.priceChanges'), desc: t('settings.notif.priceChangesDesc') },
  { id: 'email', label: t('settings.notif.email'), desc: t('settings.notif.emailDesc') },
  { id: 'sms', label: t('settings.notif.sms'), desc: t('settings.notif.smsDesc') },
];

const LANGUAGES = [
  { id: 'uz', label: "O'zbek (lotin)" },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

const FONT_SIZES: Record<FontSize, string> = { small: '15px', medium: '', large: '17.5px' };

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw || pw.length < 4) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 3) as 1 | 2 | 3;
}

const STRENGTH_COLORS: Record<number, string> = { 1: '#ef4444', 2: '#f59e0b', 3: '#22c55e' };

/** Generic pill segmented control (theme / language / font / currency). */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={value === opt.id}
          className={`segmented-btn${value === opt.id ? ' is-active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Reusable section card: heading + optional muted description + children. */
function SettingsCard({
  title,
  subtitle,
  children,
  danger,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className="card-surface profile-card"
      style={danger ? { borderColor: 'rgba(239, 68, 68, 0.3)' } : undefined}
    >
      <div>
        <h2
          className="text-base font-semibold"
          style={{ color: danger ? '#fca5a5' : 'var(--text-primary)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const { showToast, clearFavs } = useApp();
  const theme = useTheme();

  // ---- password ----
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState<{ current: boolean; next: boolean; confirm: boolean }>({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  // ---- phone verification ----
  const [verified, setVerified] = useState(getPhoneVerified());
  const [otpActive, setOtpActive] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  // ---- notifications ----
  const [notif, setNotif] = useState<NotificationsPrefs>(getNotifications());
  const [flashRow, setFlashRow] = useState<keyof NotificationsPrefs | null>(null);
  const flashTimeout = useRef<number | null>(null);

  // ---- appearance ----
  const [lang, setLang] = useState(getLanguage());
  const [font, setFont] = useState<FontSize>(getFontSize());

  // ---- regional / calculator ----
  const [region, setRegion] = useState(getDefaultRegion());
  const [currency, setCurrency] = useState<CurrencyFormat>(getCurrency());
  const [confirmResetPrices, setConfirmResetPrices] = useState(false);

  // ---- privacy ----
  const [confirmClearData, setConfirmClearData] = useState(false);

  // ---- danger zone ----
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');

  // OTP resend countdown.
  useEffect(() => {
    if (!otpActive || otpTimer <= 0) return;
    const id = window.setTimeout(() => setOtpTimer((v) => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [otpActive, otpTimer]);

  // Apply stored font-size to the app root (global, persists across pages).
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[font] || '';
  }, [font]);

  const strength = passwordStrength(newPw);

  const pwCanSave =
    currentPw.length > 0 && newPw.length >= 4 && confirmPw === newPw && newPw.length > 0;

  const savePassword = () => {
    const errs: typeof pwErrors = {};
    if (!currentPw) errs.current = t('settings.passwordRequired');
    if (newPw.length < 4) errs.next = t('settings.passwordShort');
    if (confirmPw !== newPw) errs.confirm = t('settings.passwordMismatch');
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    showToast(t('settings.passwordUpdated'));
  };

  const startOtp = () => {
    setOtpActive(true);
    setOtpCode('');
    setOtpError('');
    setOtpTimer(30);
    showToast(t('settings.otpSent'), 'info');
  };

  const resendOtp = () => {
    setOtpTimer(30);
    setOtpError('');
    showToast(t('settings.otpResent'), 'info');
  };

  const submitOtp = () => {
    if (otpCode.replace(/\D/g, '').length !== 6) {
      setOtpError(t('settings.otpError'));
      return;
    }
    savePhoneVerified(true);
    setVerified(true);
    setOtpActive(false);
    showToast(t('settings.phoneVerifiedNow'));
  };

  const toggleNotif = (id: keyof NotificationsPrefs) => {
    const next = { ...notif, [id]: !notif[id] };
    setNotif(next);
    try {
      saveNotifications(next);
    } catch {
      setNotif(notif);
      showToast(t('settings.error'), 'error');
      return;
    }
    setFlashRow(id);
    if (flashTimeout.current) window.clearTimeout(flashTimeout.current);
    flashTimeout.current = window.setTimeout(() => setFlashRow(null), 1200);
  };

  const changeRegion = (id: string) => {
    setRegion(id);
    saveDefaultRegion(id);
  };

  const changeCurrency = (fmt: CurrencyFormat) => {
    setCurrency(fmt);
    saveCurrency(fmt);
  };

  const changeLang = (id: string) => {
    if (id === lang) return;
    setLang(id);
    saveLanguage(id);
    showToast(t('settings.languageUpdated'), 'info');
  };

  const changeFont = (size: FontSize) => {
    setFont(size);
    saveFontSize(size);
  };

  const exportHistory = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      history: getHistory(),
      favorites: getFavorites(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uy-loyiha-hisoblar.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('settings.exportDone'), 'info');
  };

  const clearAllData = () => {
    clearAllLocalData();
    clearFavs();
    setNotif({ newProjects: true, priceChanges: true, email: true, sms: true });
    setRegion(DEFAULT_REGION_ID);
    setCurrency('som');
    setFont('medium');
    setLang('uz');
    setVerified(false);
    setConfirmClearData(false);
    showToast(t('settings.clearDataDone'));
  };

  const renderPwToggle = (key: 'current' | 'next' | 'confirm') => {
    const shown = showPw[key];
    return (
      <button
        type="button"
        className="control-suffix"
        aria-label={shown ? t('settings.hidePassword') : t('settings.showPassword')}
        onClick={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))}
      >
        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    );
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  } as const;

  return (
    <div className="max-w-[720px] mx-auto w-full flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('settings.subtitle')}
        </p>
      </div>

      {/* ---- 1. ACCOUNT ---- */}
      <SettingsCard title={t('settings.account')} subtitle={t('settings.accountSub')}>
        <div className="field">
          <label htmlFor="settings-curpw">{t('settings.currentPassword')}</label>
          <div className="control-wrap">
            <input
              id="settings-curpw"
              type={showPw.current ? 'text' : 'password'}
              className="control control-with-suffix"
              value={currentPw}
              autoComplete="current-password"
              onChange={(e) => setCurrentPw(e.target.value)}
            />
            {renderPwToggle('current')}
          </div>
          {pwErrors.current && <p className="error-text">{pwErrors.current}</p>}
        </div>

        <div className="field">
          <label htmlFor="settings-newpw">{t('settings.newPassword')}</label>
          <div className="control-wrap">
            <input
              id="settings-newpw"
              type={showPw.next ? 'text' : 'password'}
              className="control control-with-suffix"
              value={newPw}
              autoComplete="new-password"
              onChange={(e) => setNewPw(e.target.value)}
            />
            {renderPwToggle('next')}
          </div>
          {newPw.length > 0 && (
            <>
              <div className="strength-bar" role="meter" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={3}>
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`strength-seg${i <= strength ? '' : ' is-empty'}`}
                    style={i <= strength ? { backgroundColor: STRENGTH_COLORS[strength] } : undefined}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strength ? STRENGTH_COLORS[strength] : 'var(--text-muted)' }}>
                {strength === 1 && t('settings.strengthWeak')}
                {strength === 2 && t('settings.strengthMedium')}
                {strength === 3 && t('settings.strengthStrong')}
              </p>
            </>
          )}
          {pwErrors.next && <p className="error-text">{pwErrors.next}</p>}
        </div>

        <div className="field">
          <label htmlFor="settings-confpw">{t('settings.confirmPassword')}</label>
          <div className="control-wrap">
            <input
              id="settings-confpw"
              type={showPw.confirm ? 'text' : 'password'}
              className="control control-with-suffix"
              value={confirmPw}
              autoComplete="new-password"
              onChange={(e) => setConfirmPw(e.target.value)}
            />
            {renderPwToggle('confirm')}
          </div>
          {pwErrors.confirm && <p className="error-text">{pwErrors.confirm}</p>}
        </div>

        <div>
          <button className="btn btn-primary btn-sm" disabled={!pwCanSave} onClick={savePassword}>
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            {t('profile.save')}
          </button>
        </div>

        <div className="settings-divider" />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`chip${verified ? ' chip-verified' : ' chip-unverified'}`}
              role="status"
            >
              {verified ? t('settings.phoneVerified') : t('settings.phoneUnverified')}
            </span>
            {otpActive && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {verified ? '' : '••••••'}
              </span>
            )}
          </div>

          {!verified && (
            <button className="btn btn-secondary btn-sm" onClick={startOtp}>
              {t('settings.verifyPhone')}
            </button>
          )}
        </div>

        {otpActive && !verified && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="control otp-input"
                value={otpCode}
                inputMode="numeric"
                maxLength={6}
                placeholder={t('settings.otpPlaceholder')}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, ''));
                  setOtpError('');
                }}
              />
              <button className="btn btn-primary btn-sm" disabled={otpCode.length !== 6} onClick={submitOtp}>
                {t('settings.otpSubmit')}
              </button>
              <button className="btn btn-secondary btn-sm" disabled={otpTimer > 0} onClick={resendOtp}>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {otpTimer > 0 ? t('settings.otpResendIn', String(otpTimer)) : t('settings.otpResend')}
              </button>
            </div>
            {otpError && <p className="error-text">{otpError}</p>}
          </div>
        )}
      </SettingsCard>

      {/* ---- 2. NOTIFICATIONS ---- */}
      <SettingsCard title={t('settings.notifications')} subtitle={t('settings.notificationsSub')}>
        <div className="flex flex-col">
          {NOTIF_ROWS.map((row, idx) => (
            <div key={row.id} style={{ ...rowStyle, borderBottom: idx === NOTIF_ROWS.length - 1 ? 'none' : rowStyle.borderBottom }}>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.label}
                </p>
                {row.desc && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {row.desc}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`flash-check${flashRow === row.id ? ' is-visible' : ''}`} aria-hidden="true">
                  <Check className="w-3.5 h-3.5" />
                </span>
                <Switch
                  checked={notif[row.id]}
                  label={row.label}
                  onToggle={() => toggleNotif(row.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* ---- 3. APPEARANCE ---- */}
      <SettingsCard title={t('settings.appearance')} subtitle={t('settings.appearanceSub')}>
        <div className="field">
          <label>{t('settings.themeMode')}</label>
          <Segmented<ThemeMode>
            options={[
              { id: 'light', label: t('settings.themeLight') },
              { id: 'dark', label: t('settings.themeDark') },
              { id: 'system', label: t('settings.themeSystem') },
            ]}
            value={theme.mode}
            onChange={(m) => theme.setMode(m)}
          />
        </div>

        <div className="field">
          <label>{t('settings.language')}</label>
          <Segmented options={LANGUAGES} value={lang} onChange={changeLang} />
        </div>

        <div className="field">
          <label>{t('settings.fontSize')}</label>
          <Segmented<FontSize>
            options={[
              { id: 'small', label: t('settings.fontSmall') },
              { id: 'medium', label: t('settings.fontMedium') },
              { id: 'large', label: t('settings.fontLarge') },
            ]}
            value={font}
            onChange={changeFont}
          />
        </div>
      </SettingsCard>

      {/* ---- 4. REGIONAL & CALCULATOR ---- */}
      <SettingsCard title={t('settings.region')} subtitle={t('settings.regionSub')}>
        <div className="field">
          <label htmlFor="settings-region">{t('profile.region')}</label>
          <select id="settings-region" className="control" value={region} onChange={(e) => changeRegion(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('settings.currency')}</label>
          <Segmented<CurrencyFormat>
            options={[
              { id: 'som', label: t('settings.currencySom') },
              { id: 'uzs', label: t('settings.currencyUZS') },
            ]}
            value={currency}
            onChange={changeCurrency}
          />
        </div>

        {confirmResetPrices ? (
          <div className="saved-confirm" role="alert">
            <p>{t('settings.resetPricesConfirm')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  resetMaterialPrices();
                  setConfirmResetPrices(false);
                  showToast(t('settings.resetPricesDone'));
                }}
              >
                {t('settings.resetPricesYes')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmResetPrices(false)}>
                {t('settings.resetPricesNo')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmResetPrices(true)}>
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t('settings.resetPrices')}
            </button>
          </div>
        )}
      </SettingsCard>

      {/* ---- 5. PRIVACY & DATA ---- */}
      <SettingsCard title={t('settings.privacy')} subtitle={t('settings.privacySub')}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={exportHistory}>
            <Download className="w-4 h-4" aria-hidden="true" />
            {t('settings.export')}
          </button>
        </div>

        {confirmClearData ? (
          <div className="saved-confirm" role="alert">
            <p>{t('settings.clearDataConfirm')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn btn-danger btn-sm" onClick={clearAllData}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {t('settings.clearDataYes')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClearData(false)}>
                {t('settings.clearDataNo')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmClearData(true)}>
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              {t('settings.clearData')}
            </button>
          </div>
        )}
      </SettingsCard>

      {/* ---- 6. DANGER ZONE (ACCOUNT) ---- */}
      <SettingsCard title={t('settings.dangerZone')} subtitle={t('settings.dangerSub')} danger>
        {confirmDeactivate ? (
          <div className="saved-confirm" role="alert">
            <p>{t('settings.deactivateConfirm')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setConfirmDeactivate(false);
                  showToast(t('settings.deactivated'));
                  onLogout?.();
                }}
              >
                {t('settings.deactivateYes')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeactivate(false)}>
                {t('settings.deactivateNo')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeactivate(true)}>
              <UserX className="w-4 h-4" aria-hidden="true" />
              {t('settings.deactivate')}
            </button>
          </div>
        )}

        {confirmDelete ? (
          <div className="saved-confirm" role="alert">
            <p>{t('settings.deleteConfirm')}</p>
            <input
              className="control"
              value={deletePhrase}
              placeholder={t('settings.deletePlaceholder')}
              onChange={(e) => setDeletePhrase(e.target.value)}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="btn btn-danger-solid btn-sm"
                disabled={deletePhrase !== t('settings.deletePhrase')}
                onClick={() => {
                  clearAllLocalData();
                  setConfirmDelete(false);
                  onLogout?.();
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {t('settings.deleteYes')}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeletePhrase('');
                }}
              >
                {t('settings.deleteNo')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className="btn btn-danger-solid" onClick={() => setConfirmDelete(true)}>
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              {t('settings.deleteAccount')}
            </button>
          </div>
        )}
      </SettingsCard>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Uy Loyiha Studio v1.0
      </p>
    </div>
  );
}
