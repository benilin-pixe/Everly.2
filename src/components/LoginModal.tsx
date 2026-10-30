import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  authenticateWithPassword,
  setupUserPasswordApi,
  PRIMARY_OWNER_EMAIL,
  SHARED_USER_EMAIL,
  isEmailAuthorized,
} from '../services/authService';
import { AuthorizedUser } from '../types';

interface LoginModalProps {
  onLoginSuccess: (user: AuthorizedUser) => void;
  onLoginDenied?: (attemptedEmail: string) => void;
  initialEmail?: string;
  onCancel?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setSuccessNotice(null);

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorNotice('Please enter a valid email address.');
      return;
    }

    if (!isEmailAuthorized(cleanEmail)) {
      setErrorNotice('This email address is not authorized to access Everly.');
      return;
    }

    if (!password) {
      setErrorNotice('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setErrorNotice('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSetupMode || isResetMode) {
        if (password.length < 6) {
          setErrorNotice('Password must be at least 6 characters long.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorNotice('Passwords do not match.');
          setIsLoading(false);
          return;
        }

        const user = await setupUserPasswordApi(cleanEmail, password);
        setSuccessNotice(isResetMode ? 'Password successfully reset! Logging you in...' : 'Password successfully configured! Logging you in...');
        setTimeout(() => {
          onLoginSuccess(user);
        }, 800);
      } else {
        try {
          const user = await authenticateWithPassword(cleanEmail, password);
          onLoginSuccess(user);
        } catch (err: any) {
          if (err?.needsSetup) {
            setIsSetupMode(true);
            setErrorNotice('Password not yet set up for this account. Please create a secure password below.');
          } else {
            setErrorNotice(err?.message || 'Incorrect email or password.');
          }
        }
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Authentication failed. Please try again.');
    } finally {
      if (!successNotice) {
        setIsLoading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-rose-950/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-950/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-64 h-64 bg-violet-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0e131f]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-10 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/apple-touch-icon.png"
              alt="Everly"
              className="w-16 h-16 rounded-2xl border border-rose-500/30 shadow-xl shadow-purple-900/40 object-cover"
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Everly</span>
            <Sparkles className="w-5 h-5 text-amber-300" />
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-rose-300/80 font-medium max-w-xs mx-auto">
            Shared memories, inside jokes and everyday moments—all in one place.
          </p>
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs text-left flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-semibold block text-emerald-300">Success</span>
              <span>{successNotice}</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs text-left flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-300">Notice</span>
              <span>{errorNotice}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Quick Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Authorized Owner Account
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setEmail(PRIMARY_OWNER_EMAIL);
                  setErrorNotice(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()
                    ? 'bg-rose-500/20 border-rose-500/60 text-white shadow-sm'
                    : 'bg-[#080b11] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                }`}
              >
                <div className="font-semibold text-xs text-white">BeniLin</div>
                <div className="text-[10px] text-rose-300 font-mono truncate">{PRIMARY_OWNER_EMAIL}</div>
                <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold">OWNER</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail(SHARED_USER_EMAIL);
                  setErrorNotice(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  email.toLowerCase() === SHARED_USER_EMAIL.toLowerCase()
                    ? 'bg-rose-500/20 border-rose-500/60 text-white shadow-sm'
                    : 'bg-[#080b11] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                }`}
              >
                <div className="font-semibold text-xs text-white">Shana Love</div>
                <div className="text-[10px] text-pink-300 font-mono truncate">{SHARED_USER_EMAIL}</div>
                <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-pink-500/30 text-pink-200 font-bold">OWNER</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Authorized Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. benilin76@gmail.com"
                className="w-full bg-[#080b11] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isSetupMode || isResetMode ? 'Create New Password' : 'Password'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#080b11] border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {(isSetupMode || isResetMode) && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#080b11] border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              <>
                <span>{isSetupMode || isResetMode ? 'Save Password & Log In' : 'Log In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle setup / reset mode */}
        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              if (isSetupMode || isResetMode) {
                setIsSetupMode(false);
                setIsResetMode(false);
              } else {
                setIsSetupMode(true);
              }
              setErrorNotice(null);
            }}
            className="text-rose-300/80 hover:text-rose-300 underline cursor-pointer"
          >
            {isSetupMode || isResetMode ? 'Already configured? Back to Log In' : 'First time setup'}
          </button>

          {!isSetupMode && !isResetMode && (
            <button
              type="button"
              onClick={() => {
                setIsResetMode(true);
                setIsSetupMode(false);
                setErrorNotice(null);
              }}
              className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Reset Password
            </button>
          )}
        </div>

        {/* Security & Access Policy Badges */}
        <div className="mt-7 pt-5 border-t border-white/5 space-y-3">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-left text-xs text-slate-300 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-white block">Authorized Access Only</span>
              <span className="text-slate-400">
                A private shared space for two friends. Access is strictly limited to verified accounts:
              </span>
              <div className="mt-1 font-mono text-[10px] space-y-0.5 text-rose-300">
                <div>• {PRIMARY_OWNER_EMAIL} <span className="text-emerald-400 font-sans font-semibold">(Owner)</span></div>
                <div>• {SHARED_USER_EMAIL} <span className="text-pink-400 font-sans font-semibold">(Owner)</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-slate-300">Secured PBKDF2</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
              <Lock className="w-4 h-4 text-rose-400" />
              <span className="font-medium text-slate-300">Private Vault</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-medium text-slate-300">Strict Whitelist</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
