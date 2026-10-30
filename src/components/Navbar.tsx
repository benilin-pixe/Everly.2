import React, { useState } from 'react';
import { AuthorizedUser } from '../types';
import {
  Image,
  Film,
  Music,
  FileText,
  UploadCloud,
  LogOut,
  HardDrive,
  Heart,
  ChevronDown,
  Sparkles,
  MessageSquareHeart,
  Radio,
  Palette,
  MessageSquare,
  Server,
  LogIn,
  Users,
  ArrowLeftRight,
} from 'lucide-react';
import { PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL } from '../services/authService';

export type TabType = 'moments' | 'cinema' | 'music' | 'vault' | 'board' | 'dropzone';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  currentUser: AuthorizedUser | null;
  onLogout: () => void;
  onSwitchAccount?: (targetEmail: string) => void;
  storageUsagePercent: number;
  onOpenStorageModal: () => void;
  onOpenSoundtrackManager?: () => void;
  onOpenThemeModal?: () => void;
  onOpenStorageServers?: () => void;
  unreadMessagesCount?: number;
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  storageUsagePercent,
  onOpenStorageModal,
  onOpenSoundtrackManager,
  onOpenThemeModal,
  onOpenStorageServers,
  unreadMessagesCount = 0,
  onOpenLogin,
  onSwitchAccount,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'moments', label: 'Moments', icon: <Image className="w-4 h-4" /> },
    { id: 'cinema', label: 'Cinema', icon: <Film className="w-4 h-4" /> },
    { id: 'music', label: 'Music Box', icon: <Music className="w-4 h-4" /> },
    { id: 'vault', label: 'Vault', icon: <FileText className="w-4 h-4" /> },
    { id: 'board', label: 'Message Board', icon: <MessageSquareHeart className="w-4 h-4 text-rose-400" /> },
    { id: 'dropzone', label: 'Dropzone', icon: <UploadCloud className="w-4 h-4" /> },
  ];

  const otherOwnerEmail =
    currentUser?.email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()
      ? SHARED_USER_EMAIL
      : PRIMARY_OWNER_EMAIL;
  const otherOwnerName =
    currentUser?.email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()
      ? 'Shana Love'
      : 'BeniLin';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#080b12]/90 backdrop-blur-xl border-b border-rose-500/15 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onSelectTab('moments')}
          className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-rose-300 transition-colors flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <img
            src="/favicon-32x32.png"
            alt="Everly"
            className="w-6 h-6 rounded-md shadow-sm shadow-purple-500/40 object-contain shrink-0"
          />
          <span className="font-extrabold bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent">
            Everly
          </span>
          <span className="hidden lg:inline text-[11px] text-rose-300/80 font-normal pl-1.5 border-l border-white/10 tracking-wide">
            A space for two friends
          </span>
        </button>

        {/* Zone 2: Navigation tabs with single-line labels */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm shadow-rose-950/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Storage quota button and Active user profile OR Guest Log In button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!currentUser ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>Owner Log In</span>
              </button>
            </div>
          ) : (
            <>
              {/* Theme Studio Button */}
              {onOpenThemeModal && (
                <button
                  onClick={onOpenThemeModal}
                  title="Appearance & Theme Studio"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#121624] hover:bg-[#181e30] border border-white/10 hover:border-rose-500/30 rounded-xl text-xs text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm"
                >
                  <Palette className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline font-medium">Themes</span>
                </button>
              )}

              {/* Storage Quota Trigger */}
              <button
                onClick={onOpenStorageModal}
                title="Google Drive Storage Usage"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#121624] hover:bg-[#181e30] border border-white/10 hover:border-rose-500/30 rounded-xl text-xs text-slate-300 transition-colors cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-mono tabular-nums">{storageUsagePercent}%</span>
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                    style={{ width: `${Math.max(5, storageUsagePercent)}%` }}
                  />
                </div>
              </button>

              {/* Direct Quick Account Switcher Button */}
              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={() => onSwitchAccount(otherOwnerEmail)}
                  title={`Switch to ${otherOwnerName} (${otherOwnerEmail})`}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#121624] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 rounded-xl text-xs text-rose-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline font-medium">Switch to {otherOwnerName.split(' ')[0]}</span>
                </button>
              )}

              {/* User Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 bg-[#121624] hover:bg-[#181e30] border border-white/10 hover:border-rose-500/30 rounded-xl text-xs text-white transition-colors cursor-pointer"
                  aria-label="User profile menu"
                >
                  <div
                    className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentUser.avatarColor} flex items-center justify-center font-bold text-[11px] text-white shadow-sm overflow-hidden`}
                  >
                    {currentUser.picture ? (
                      <img src={currentUser.picture} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.avatarInitials
                    )}
                  </div>
                  <span className="hidden sm:inline font-medium text-slate-200">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-[#121624] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                      {/* Active Account Info */}
                      <div className="px-3 py-2.5 border-b border-white/5">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Active Account
                        </div>
                        <div className="font-semibold text-white truncate text-sm">{currentUser.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {currentUser.email}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                          <Heart className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                          <span>CO-OWNER (ADMINISTRATOR)</span>
                        </div>
                      </div>

                      {/* Authorized Accounts & Switch Option */}
                      <div className="py-2 px-1 border-b border-white/5 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-rose-400" />
                          <span>Switch Owner Account</span>
                        </div>

                        {/* BeniLin Card */}
                        <div className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                          currentUser.email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()
                            ? 'bg-rose-500/15 border border-rose-500/30'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                              BL
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate text-[11px]">BeniLin</div>
                              <div className="text-[9px] font-mono text-slate-400 truncate">{PRIMARY_OWNER_EMAIL}</div>
                            </div>
                          </div>
                          {currentUser.email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase() ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">ACTIVE</span>
                          ) : (
                            <button
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onSwitchAccount?.(PRIMARY_OWNER_EMAIL);
                              }}
                              className="text-[10px] px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer shrink-0"
                            >
                              Switch
                            </button>
                          )}
                        </div>

                        {/* Shana Love Card */}
                        <div className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                          currentUser.email.toLowerCase() === SHARED_USER_EMAIL.toLowerCase()
                            ? 'bg-rose-500/15 border border-rose-500/30'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                              SL
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate text-[11px]">Shana Love</div>
                              <div className="text-[9px] font-mono text-slate-400 truncate">{SHARED_USER_EMAIL}</div>
                            </div>
                          </div>
                          {currentUser.email.toLowerCase() === SHARED_USER_EMAIL.toLowerCase() ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">ACTIVE</span>
                          ) : (
                            <button
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onSwitchAccount?.(SHARED_USER_EMAIL);
                              }}
                              className="text-[10px] px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer shrink-0"
                            >
                              Switch
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="py-1">
                        {onOpenThemeModal && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenThemeModal();
                            }}
                            className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Palette className="w-3.5 h-3.5 text-rose-400" />
                            <span>Appearance & Themes</span>
                          </button>
                        )}
                        {onOpenSoundtrackManager && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenSoundtrackManager();
                            }}
                            className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Radio className="w-3.5 h-3.5 text-rose-400" />
                            <span>Soundtrack Manager</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenStorageModal();
                          }}
                          className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors md:hidden cursor-pointer"
                        >
                          <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                          <span>Drive Storage: {storageUsagePercent}%</span>
                        </button>
                        {onOpenStorageServers && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenStorageServers();
                            }}
                            className="w-full px-3 py-2 text-left text-rose-300 hover:text-white hover:bg-rose-500/10 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Server className="w-3.5 h-3.5 text-rose-400" />
                            <span className="font-medium">Storage Servers (Admin)</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full px-3 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
