import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Lock, User, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';
import { runWithProgress } from '../../lib/progress';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (user: { id: number; name: string; phone: string }) => void;
}

type AuthTab = 'login' | 'register';

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setPhone('');
      setPassword('');
      setName('');
      setErrors({});
      setTab('login');
    }
  }, [isOpen]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!phone.match(/^\+?\d{9,12}$/)) {
      errs.phone = 'Telefon raqam noto’g’ri (masalan: +998901234567)';
    }
    if (password.length < 4) {
      errs.password = 'Parol kamida 4 belgi bo’lishi kerak';
    }
    if (tab === 'register' && name.trim().length < 2) {
      errs.name = 'Ismingizni kiriting';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await runWithProgress(async () => {
        if (tab === 'register') {
          const user = await api.signup({ name, phone, password });
          onAuthSuccess?.(user);
        } else {
          const user = await api.login(phone, password);
          onAuthSuccess?.(user);
        }
        onClose();
      });
    } catch (err: any) {
      setErrors({ form: err.message || 'Xatolik yuz berdi' });
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: AuthTab) {
    setTab(t);
    setErrors({});
    setShowPassword(false);
  }

  const inputClass = (field: string) =>
    `w-full pl-10 pr-10 py-3 rounded-xl text-sm border outline-none transition-all duration-200 ${
      errors[field] ? 'border-red-400 ring-2 ring-red-500/20' : 'border-[var(--input-border)] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20'
    }`;

  const canSubmit =
    !loading &&
    (tab === 'login' || name.trim().length >= 2) &&
    /^\+?\d{9,12}$/.test(phone) &&
    password.length >= 4;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.target === overlayRef.current && onClose()}
        >
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          >
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
              style={{
                background: 'radial-gradient(circle, #007AFF 0%, #5856D6 50%, transparent 70%)',
                top: '20%',
                left: '10%',
              }}
              animate={{
                x: [0, 40, -20, 0],
                y: [0, -30, 20, 0],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full opacity-30 blur-3xl"
              style={{
                background: 'radial-gradient(circle, #AF52DE 0%, #FF2D55 50%, transparent 70%)',
                bottom: '10%',
                right: '15%',
              }}
              animate={{
                x: [0, -30, 20, 0],
                y: [0, 30, -20, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <motion.div
            className="relative w-full max-w-sm rounded-2xl border shadow-[0_25px_60px_rgba(0,0,0,0.2)] overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-panel)',
              backdropFilter: 'blur(24px)',
              borderColor: 'var(--border-panel)',
            }}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={() => switchTab('login')}
                  className="text-sm font-semibold pb-1 relative"
                  style={{ color: tab === 'login' ? '#007AFF' : 'var(--text-secondary)' }}
                >
                  Kirish
                  {tab === 'login' && (
                    <motion.div
                      layoutId="auth-tab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007AFF] rounded-full"
                    />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => switchTab('register')}
                  className="text-sm font-semibold pb-1 relative"
                  style={{ color: tab === 'register' ? '#007AFF' : 'var(--text-secondary)' }}
                >
                  Ro’yxatdan o’tish
                  {tab === 'register' && (
                    <motion.div
                      layoutId="auth-tab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007AFF] rounded-full"
                    />
                  )}
                </motion.button>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
              {errors.form && (
                <p className="text-xs text-red-500 text-center">{errors.form}</p>
              )}

              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Ism <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Abdulla"
                      className={inputClass('name')}
                      style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Telefon raqam <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998901234567"
                    className={inputClass('phone')}
                    style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)' }}
                  />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Parol <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className={inputClass('password')}
                    style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              </div>

              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                whileTap={{ scale: canSubmit ? 0.97 : 1 }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-b from-[#0A84FF] to-[#0060DF] shadow-[0_6px_20px_rgba(10,132,255,0.3)] hover:shadow-[0_10px_28px_rgba(10,132,255,0.45)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Yuklanmoqda...' : tab === 'login' ? 'Kirish' : "Ro’yxatdan o’tish"}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
