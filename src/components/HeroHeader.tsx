import React, { useMemo } from 'react';
import { AuthorizedUser, StorageStats } from '../types';
import { Heart, HardDrive, Moon, Sun, Sunset, Sunrise } from 'lucide-react';
import { formatBytes } from '../services/storageService';
import { LiveClock } from './LiveClock';

interface HeroHeaderProps {
  currentUser?: AuthorizedUser | null;
  stats: StorageStats;
  onOpenStorageModal: () => void;
  activeTab: string;
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({
  currentUser,
  stats,
  onOpenStorageModal,
}) => {
  const { greeting, timeIcon, subGreeting } = useMemo(() => {
    const hour = new Date().getHours();
    const nameStr = currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : '';

    if (hour >= 5 && hour < 12) {
      return {
        greeting: `Good morning${nameStr}`,
        timeIcon: <Sunrise className="w-4 h-4 text-amber-300" />,
        subGreeting: `Your next favourite moment starts here. ✨`,
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        greeting: `Good afternoon${nameStr}`,
        timeIcon: <Sun className="w-4 h-4 text-amber-400" />,
        subGreeting: `Your next favourite moment starts here. ✨`,
      };
    } else if (hour >= 17 && hour < 22) {
      return {
        greeting: `Good evening${nameStr}`,
        timeIcon: <Sunset className="w-4 h-4 text-rose-400" />,
        subGreeting: `Your next favourite moment starts here. ✨`,
      };
    } else {
      return {
        greeting: `Late night quietude${nameStr}`,
        timeIcon: <Moon className="w-4 h-4 text-indigo-300" />,
        subGreeting: `Your next favourite moment starts here. ✨`,
      };
    }
  }, [currentUser]);

  return (
    <div className="relative mb-8 rounded-3xl overflow-hidden border border-sky-500/30 bg-gradient-to-br from-slate-950 via-indigo-950/90 to-[#0b0f19] shadow-2xl">
      {/* Static clean anime-inspired ambient background glow */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 sm:p-8">
        {/* Left Column: Title, Subtitle, & Live Greeting */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5 drop-shadow-md">
              <span>A space for two friends.</span>
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-sky-200/90 max-w-xl leading-relaxed font-medium drop-shadow">
            Shared memories, inside jokes and everyday moments—all in one place.
          </p>

          {/* Live Date, Time & Greeting Component */}
          <div className="pt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-300">
            <span className="font-semibold text-rose-300 flex items-center gap-1.5">
              <span>{greeting}</span>
              <span className="inline-flex p-1 rounded-lg bg-white/10 border border-white/20">
                {timeIcon}
              </span>
            </span>
            <div className="border-l border-white/10 pl-2.5">
              <LiveClock variant="hero" />
            </div>
          </div>
        </div>

        {/* Right Column: Quick Status & Quota Stats Card */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-[#090c15]/85 backdrop-blur-md border border-white/15 shadow-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/30 to-amber-500/30 border border-rose-500/40 flex items-center justify-center text-rose-300">
              <Heart className="w-4 h-4 fill-rose-500/60" />
            </div>
            <div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                Friends Vault
              </div>
              <div className="text-xs font-bold text-white font-mono">
                {stats.itemCount} Memories Stored
              </div>
            </div>
          </div>

          <button
            onClick={onOpenStorageModal}
            className="p-3.5 rounded-2xl bg-[#090c15]/85 hover:bg-[#101420] backdrop-blur-md border border-white/15 hover:border-sky-400/40 transition-all flex items-center gap-3 text-left group cursor-pointer shadow-xl"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/30 to-indigo-500/30 border border-white/20 flex items-center justify-center text-sky-300 group-hover:scale-105 transition-transform">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold flex items-center gap-1">
                <span>Drive Storage</span>
                <span className="text-[9px] text-emerald-400">● Synced</span>
              </div>
              <div className="text-xs font-bold text-white font-mono">
                {formatBytes(stats.usedBytes)} / 15 GB
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
