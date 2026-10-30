import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, RefreshCw, UserCheck } from 'lucide-react';
import { clearDeniedAttempt, PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL } from '../services/authService';

interface AccessDeniedProps {
  attemptedEmail: string;
  onRetry: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  attemptedEmail,
  onRetry,
}) => {
  const handleSwitchAccount = () => {
    clearDeniedAttempt();
    onRetry();
  };

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-rose-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0e131f] border border-rose-500/30 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 text-center">
        {/* Shield icon */}
        <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Access Denied
        </h1>
        <p className="mt-2 text-rose-300 font-medium text-sm">
          This account is not authorized to access Everly.
        </p>

        {/* Security Details */}
        <div className="mt-6 p-4 rounded-2xl bg-[#080b11] border border-white/5 text-left space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Attempted Account</span>
            <span className="font-mono text-rose-300 font-medium truncate max-w-[220px]">
              {attemptedEmail || 'unknown@example.com'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Access Policy</span>
            <span className="text-slate-300">Strict Whitelist (2 Authorized Owners)</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Storage Vault</span>
            <span className="text-rose-300 font-medium">Everly Cloud Media Vault</span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
            <Lock className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
            <div>
              Access is strictly restricted to verified owner accounts:
              <div className="mt-1 font-mono text-[11px] text-slate-200 space-y-0.5">
                <div>• <span className="text-white font-medium">{PRIMARY_OWNER_EMAIL}</span> <span className="text-emerald-400 font-sans font-semibold">(Owner)</span></div>
                <div>• <span className="text-white font-medium">{SHARED_USER_EMAIL}</span> <span className="text-pink-400 font-sans font-semibold">(Owner)</span></div>
              </div>
              <div className="mt-1 text-[11px] text-rose-400/90">
                All other accounts (including benilin40@gmail.com) are rejected.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Return to Owner Log In
          </button>

          <button
            type="button"
            onClick={handleSwitchAccount}
            className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Login Screen
          </button>
        </div>
      </div>
    </main>
  );
};
