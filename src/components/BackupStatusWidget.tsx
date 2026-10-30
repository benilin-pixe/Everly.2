import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Clock,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  getLastSuccessfulSyncTimestamp,
  getSyncStatus,
  subscribeSyncStatus,
  forceCloudSync,
  reconnectDriveA,
  SyncStatus,
} from '../services/everlySyncService';
import { UnifiedFileRecord } from '../services/everlyStorageService';

interface BackupStatusWidgetProps {
  variant?: 'card' | 'compact' | 'banner';
  className?: string;
  onFilesUpdated?: (files: UnifiedFileRecord[]) => void;
  showDetails?: boolean;
}

/**
 * Formats an ISO timestamp into a human-friendly date string.
 */
function formatSyncTime(isoString: string | null): { formatted: string; relative: string; full: string } {
  if (!isoString) {
    return {
      formatted: 'Not synced yet',
      relative: 'Never',
      full: 'No sync history available',
    };
  }

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return {
        formatted: isoString,
        relative: '',
        full: isoString,
      };
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    let relative = 'Just now';
    if (diffMin >= 1 && diffMin < 60) {
      relative = `${diffMin}m ago`;
    } else if (diffHours >= 1 && diffHours < 24) {
      relative = `${diffHours}h ago`;
    } else if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      relative = `${days}d ago`;
    }

    const isToday = now.toDateString() === date.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatted = isToday ? `Today at ${timeStr}` : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;

    const full = date.toLocaleString();

    return { formatted, relative, full };
  } catch {
    return {
      formatted: isoString,
      relative: '',
      full: isoString,
    };
  }
}

export const BackupStatusWidget: React.FC<BackupStatusWidgetProps> = ({
  variant = 'card',
  className = '',
  onFilesUpdated,
  showDetails = true,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [justSynced, setJustSynced] = useState(false);
  const [ticker, setTicker] = useState(0);

  // Subscribe to real-time sync service updates
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((_files, status) => {
      setSyncStatus(status);
    });

    // Update relative timestamps every 15 seconds
    const interval = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleForceSync = async () => {
    if (syncStatus.isSyncing) return;

    setJustSynced(false);
    const result = await forceCloudSync(onFilesUpdated);

    if (result.success) {
      setJustSynced(true);
      setTimeout(() => {
        setJustSynced(false);
      }, 3500);
    }
  };

  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    const res = await reconnectDriveA();
    setIsReconnecting(false);
    if (res.success && onFilesUpdated) {
      forceCloudSync(onFilesUpdated);
    }
  };

  const { formatted, relative, full } = formatSyncTime(syncStatus.lastSyncedAt);

  // =========================================================================
  // COMPACT VARIANT (Great for Headers, Navbars, Toolbars, and Storage Modals)
  // =========================================================================
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl bg-[#090d16]/90 border border-white/10 text-xs backdrop-blur-md ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cloud className="w-3.5 h-3.5" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#090d16] ${
                syncStatus.isSyncing
                  ? 'bg-amber-400 animate-ping'
                  : syncStatus.isDriveAAuthExpired || syncStatus.error
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <span className="truncate">{syncStatus.isDriveAAuthExpired ? 'Drive A Auth Expired' : 'Google Drive Backup'}</span>
              {relative && !syncStatus.isDriveAAuthExpired && <span className="text-[10px] text-slate-500">({relative})</span>}
            </div>
            <div className="text-[10px] text-slate-400 truncate" title={full}>
              {syncStatus.isSyncing ? (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin inline" /> Syncing...
                </span>
              ) : syncStatus.isDriveAAuthExpired ? (
                <span className="text-rose-400 font-medium">Token expired. Reconnect required.</span>
              ) : (
                <span>Last sync: {formatted}</span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={syncStatus.isDriveAAuthExpired ? handleReconnect : handleForceSync}
          disabled={syncStatus.isSyncing || isReconnecting}
          className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            syncStatus.isDriveAAuthExpired
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-950 font-bold'
              : syncStatus.isSyncing
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-70'
              : justSynced
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm shadow-indigo-950'
          }`}
          title={syncStatus.isDriveAAuthExpired ? 'Reconnect Google Drive A account' : 'Force an immediate cloud synchronization with Google Drive'}
        >
          {syncStatus.isDriveAAuthExpired ? (
            <>
              <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
              <span>{isReconnecting ? 'Connecting...' : 'Reconnect Drive A'}</span>
            </>
          ) : syncStatus.isSyncing ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Syncing</span>
            </>
          ) : justSynced ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Synced!</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              <span>Force Sync</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // =========================================================================
  // BANNER VARIANT (Great for Page Tops or Modal Headers)
  // =========================================================================
  if (variant === 'banner') {
    return (
      <div
        className={`p-4 rounded-2xl bg-gradient-to-r from-[#0b101d] via-[#10172c] to-[#0d1326] border border-indigo-500/25 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 shadow-lg ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Google Drive Backup Status</h4>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  syncStatus.isSyncing
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                    : syncStatus.error
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {syncStatus.isSyncing ? 'Syncing...' : syncStatus.error ? 'Sync Error' : 'Up to Date'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Last successful sync: <span className="font-semibold text-white">{formatted}</span>
              {relative && <span className="text-slate-400 ml-1">({relative})</span>}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleForceSync}
          disabled={syncStatus.isSyncing}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            syncStatus.isSyncing
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-70'
              : justSynced
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-indigo-950/50'
          }`}
        >
          {syncStatus.isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing with Drive...</span>
            </>
          ) : justSynced ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Backup Updated!</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Force Sync</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // =========================================================================
  // CARD VARIANT (Default Full Featured Backup Status Widget)
  // =========================================================================
  return (
    <div
      className={`relative rounded-3xl overflow-hidden border border-indigo-500/20 bg-gradient-to-br from-[#0b0f19]/95 via-[#11172a]/90 to-[#0d1222]/95 backdrop-blur-xl p-5 sm:p-6 shadow-xl text-slate-200 transition-all ${className}`}
    >
      {/* Decorative ambient flare */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Row: Title & Real-time Status Badge */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-indigo-600/25 to-teal-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <Cloud className="w-5 h-5" />
            </div>
            {/* Google Drive Tri-color accent dot */}
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0b0f19] flex items-center justify-center ${
                syncStatus.isSyncing
                  ? 'bg-amber-400 animate-spin'
                  : syncStatus.error
                  ? 'bg-rose-500'
                  : 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Backup Status
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-medium hidden sm:inline-flex items-center gap-1">
                <span>Google Drive</span>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cloud reconciliation with Everly storage
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              syncStatus.isSyncing
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                : syncStatus.error
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950'
            }`}
          >
            {syncStatus.isSyncing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : syncStatus.error ? (
              <>
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Sync Alert</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Synced</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Content Box: Last Successful Sync Timestamp & Force Sync CTA */}
      <div className="p-4 rounded-2xl bg-[#080c16]/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Last Successful Sync</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className="text-sm sm:text-base font-bold text-white font-mono tracking-tight"
              title={full}
            >
              {formatted}
            </span>
            {relative && (
              <span className="text-xs text-indigo-300 font-medium px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-500/20">
                {relative}
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 truncate" title={full}>
            Target: Google Drive Cloud Storage (Dual Provider Sync)
          </div>
        </div>

        {/* Force Sync Action Button */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleForceSync}
            disabled={syncStatus.isSyncing}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              syncStatus.isSyncing
                ? 'bg-slate-800 text-slate-400 border border-slate-700/50 cursor-not-allowed opacity-75'
                : justSynced
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-950/60 border border-indigo-400/30 hover:scale-[1.02] active:scale-[0.98]'
            }`}
            aria-label="Force Sync with Google Drive"
          >
            {syncStatus.isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                <span>Reconciling...</span>
              </>
            ) : justSynced ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Sync Complete!</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-white" />
                <span>Force Sync</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Details Row: Provider Health, Auto-Sync Schedule & Cloud Info */}
      {showDetails && (
        <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Connected: Google Drive A & Drive B</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Auto-syncs in background every 45s</span>
          </div>
        </div>
      )}
    </div>
  );
};
