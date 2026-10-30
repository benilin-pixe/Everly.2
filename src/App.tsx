/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthorizedUser, MediaFile, StorageStats } from './types';
import {
  getStoredUser,
  setStoredUser,
  getDeniedAttempt,
  recordDeniedAttempt,
  clearDeniedAttempt,
  signOutEverly,
  AUTHORIZED_USERS,
  PRIMARY_OWNER_EMAIL,
  SHARED_USER_EMAIL,
} from './services/authService';
import {
  initEverlyCloudStorage,
  uploadToEverlyCloudStorage,
  deleteUnifiedFile,
  computeEverlyStorageStats,
  setDriveConnectionState,
  UnifiedFileRecord,
} from './services/everlyStorageService';
import {
  testFirestoreConnection,
  syncUserProfileToFirestore,
} from './services/firestoreService';

import { Sparkles, WifiOff } from 'lucide-react';
import { initCapacitorMobile } from './services/capacitorService';
import { Navbar, TabType } from './components/Navbar';
import { StorageModal } from './components/StorageBar';
import { StorageServersModal } from './components/StorageServersModal';
import { LoginModal } from './components/LoginModal';
import { AccessDenied } from './components/AccessDenied';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { PhotosTab } from './components/PhotosTab';
import { VideosTab } from './components/VideosTab';
import { MusicTab } from './components/MusicTab';
import { DocumentsTab } from './components/DocumentsTab';
import { UploadCenterTab } from './components/UploadCenterTab';
import { MemoryBoardTab } from './components/MemoryBoardTab';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { BackgroundMusicPlayer } from './components/BackgroundMusicPlayer';
import { SoundtrackManagerModal } from './components/SoundtrackManagerModal';
import { ThemeAppearanceModal } from './components/ThemeAppearanceModal';
import { WallpaperBackground } from './components/WallpaperBackground';
import { DailyQuoteCard } from './components/DailyQuoteCard';
import { FavoriteQuotesModal } from './components/FavoriteQuotesModal';
import { HeroHeader } from './components/HeroHeader';
import { BackupStatusWidget } from './components/BackupStatusWidget';
import { StarfieldParticles } from './components/StarfieldParticles';
import { realtimeChatService, markAppMounted } from './services/realtimeChatService';
import {
  BackgroundTrack,
  getMusicLibrary,
  subscribeMusicLibrary,
  initMusicLibrary,
} from './services/soundtrackService';
import {
  startEverlyBackgroundSync,
  stopEverlyBackgroundSync,
} from './services/everlySyncService';
import {
  getActiveTheme,
  applyThemeVariables,
  subscribeTheme,
  ThemePreset,
} from './services/themeService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthorizedUser | null>(null);
  const [deniedAttempt, setDeniedAttempt] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [loginTargetEmail, setLoginTargetEmail] = useState<string>('');

  // App content state
  const [currentTab, setCurrentTab] = useState<TabType>('moments');
  const [files, setFiles] = useState<UnifiedFileRecord[]>([]);
  const [musicLibrary, setMusicLibrary] = useState<BackgroundTrack[]>(getMusicLibrary);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSoundtrackModalOpen, setIsSoundtrackModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [isStorageServersModalOpen, setIsStorageServersModalOpen] = useState(false);
  const [activeTheme, setActiveThemeState] = useState<ThemePreset>(getActiveTheme);

  // Real-time Communication State
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Foreground audio player state
  const [currentTrack, setCurrentTrack] = useState<BackgroundTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Video playback tracking
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Destructive delete confirmation modal
  const [deleteTargetFile, setDeleteTargetFile] = useState<MediaFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Online status state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Initialize Capacitor Android mobile integration (hardware back button, status bar, keyboard, network)
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    initCapacitorMobile({
      onNetworkChange: (online) => {
        setIsOnline(online);
      },
      onBackButton: () => {
        if (deleteTargetFile) {
          setDeleteTargetFile(null);
          return true;
        }
        if (isStorageServersModalOpen) {
          setIsStorageServersModalOpen(false);
          return true;
        }
        if (isFavoritesModalOpen) {
          setIsFavoritesModalOpen(false);
          return true;
        }
        if (isThemeModalOpen) {
          setIsThemeModalOpen(false);
          return true;
        }
        if (isSoundtrackModalOpen) {
          setIsSoundtrackModalOpen(false);
          return true;
        }
        if (isStorageModalOpen) {
          setIsStorageModalOpen(false);
          return true;
        }
        if (currentTab !== 'moments') {
          setCurrentTab('moments');
          return true;
        }
        return false;
      },
    }).then((unsub) => {
      cleanupFn = unsub;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [
    deleteTargetFile,
    isStorageServersModalOpen,
    isFavoritesModalOpen,
    isThemeModalOpen,
    isSoundtrackModalOpen,
    isStorageModalOpen,
    currentTab,
  ]);

  // Initialize theme and music library engine
  useEffect(() => {
    applyThemeVariables(activeTheme);
    initMusicLibrary();
    const unsubTheme = subscribeTheme((theme) => {
      setActiveThemeState(theme);
    });
    const unsubMusic = subscribeMusicLibrary((lib) => {
      setMusicLibrary(lib);
    });
    return () => {
      unsubTheme();
      unsubMusic();
    };
  }, []);

  // Check persisted auth, handle OAuth redirect results, and load initial files
  useEffect(() => {
    let isCancelled = false;

    async function initializeAuth() {
      markAppMounted();
      testFirestoreConnection().catch((err) => console.warn('[Firestore] Connection test notice:', err));

      // 1. Check for active access-denied state
      const denied = getDeniedAttempt();
      if (denied && !isCancelled) {
        setDeniedAttempt(denied.email);
        setIsLoadingAuth(false);
        return;
      }

      // 3. Check persisted authorized user session
      const stored = getStoredUser();
      if (stored && !isCancelled) {
        setCurrentUser(stored);
      } else if (!isCancelled) {
        // Visitors must log in through the authorized Log In page; never make every visitor an administrator
        setCurrentUser(null);
      }

      if (!isCancelled) {
        setIsLoadingAuth(false);
      }
    }

    initializeAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  const [storageStats, setStorageStats] = useState<any>({
    usedBytes: 0,
    totalBytes: 30 * 1024 * 1024 * 1024,
    photosBytes: 0,
    videosBytes: 0,
    audioBytes: 0,
    documentsBytes: 0,
    itemCount: 0,
    driveConnected: true,
    driveOwnerEmail: PRIMARY_OWNER_EMAIL,
    sharedUserEmail: SHARED_USER_EMAIL,
  });

  // Load storage files from Everly Cloud Storage
  useEffect(() => {
    if (currentUser) {
      initEverlyCloudStorage().then(async (data) => {
        setFiles(data);
        const stats = await computeEverlyStorageStats(data);
        setStorageStats(stats);
        const lib = getMusicLibrary();
        if (lib.length > 0) {
          setCurrentTrack(lib[0]);
        }
      });

      // Start background synchronization service
      startEverlyBackgroundSync(async (syncedFiles) => {
        setFiles(syncedFiles);
        const stats = await computeEverlyStorageStats(syncedFiles);
        setStorageStats(stats);
      });

      return () => {
        stopEverlyBackgroundSync();
      };
    }
  }, [currentUser]);

  // Connect to Real-time Communication & Signaling
  useEffect(() => {
    if (!currentUser) return;

    realtimeChatService.connect(currentUser.email, currentUser.name);

    return () => {
      realtimeChatService.disconnect();
    };
  }, [currentUser]);

  // Auth Handlers
  const handleLoginSuccess = (user: AuthorizedUser) => {
    setCurrentUser(user);
    setStoredUser(user);
    setDeniedAttempt(null);
    clearDeniedAttempt();
    setLoginTargetEmail('');
  };

  const handleLoginDenied = (email: string) => {
    recordDeniedAttempt(email);
    setDeniedAttempt(email);
    setCurrentUser(null);
    setStoredUser(null);
  };

  const handleLogout = async () => {
    try {
      await signOutEverly();
    } catch (e) {
      console.warn('[Logout] Error during signOut:', e);
    }
    setCurrentUser(null);
    setStoredUser(null);
    setDeniedAttempt(null);
    clearDeniedAttempt();
    setLoginTargetEmail('');
    setIsPlaying(false);
    setIsVideoPlaying(false);
  };

  // Securely initiate account switch by clearing current session and prompting password for target owner
  const handleInitiateSwitchUser = async (targetEmail: string) => {
    try {
      await signOutEverly();
    } catch (e) {
      console.warn('[SwitchUser] Error during session teardown:', e);
    }
    setCurrentUser(null);
    setStoredUser(null);
    setDeniedAttempt(null);
    clearDeniedAttempt();
    setIsPlaying(false);
    setIsVideoPlaying(false);
    setLoginTargetEmail(targetEmail);
  };

  // Media Operations
  const handleToggleFavorite = async (id: string, currentStatus: boolean) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isFavorite: !currentStatus } : f))
    );
  };

  const handleConfirmDelete = async (file: MediaFile) => {
    setIsDeleting(true);
    await deleteUnifiedFile(file.id);
    const updatedFiles = files.filter((f) => f.id !== file.id);
    setFiles(updatedFiles);
    const stats = await computeEverlyStorageStats(updatedFiles);
    setStorageStats(stats);
    if (currentTrack?.id === file.id) {
      setIsPlaying(false);
      const remainingAudio = musicLibrary.filter((t) => t.id !== file.id);
      setCurrentTrack(remainingAudio.length > 0 ? remainingAudio[0] : null);
    }
    setIsDeleting(false);
    setDeleteTargetFile(null);
  };

  const handleUploadFile = async (file: File, caption?: string) => {
    if (!currentUser) return;
    const uploaded = await uploadToEverlyCloudStorage(file, currentUser, caption);
    const updatedFiles = [uploaded, ...files];
    setFiles(updatedFiles);
    const stats = await computeEverlyStorageStats(updatedFiles);
    setStorageStats(stats);
  };

  // Music Player navigation
  const audioPlaylist = musicLibrary;

  const handlePlayTrack = (track: BackgroundTrack) => {
    // If a video was playing, pause it
    if (isVideoPlaying) {
      setIsVideoPlaying(false);
    }
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (!currentTrack && audioPlaylist.length > 0) {
      setCurrentTrack(audioPlaylist[0]);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
    if (isVideoPlaying) {
      setIsVideoPlaying(false);
    }
  };

  const handleNextTrack = () => {
    if (!currentTrack || audioPlaylist.length === 0) return;
    const currentIndex = audioPlaylist.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % audioPlaylist.length;
    setCurrentTrack(audioPlaylist[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    if (!currentTrack || audioPlaylist.length === 0) return;
    const currentIndex = audioPlaylist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + audioPlaylist.length) % audioPlaylist.length;
    setCurrentTrack(audioPlaylist[prevIndex]);
    setIsPlaying(true);
  };

  // Video playback change handler
  const handleVideoPlaybackChange = (videoActive: boolean) => {
    setIsVideoPlaying(videoActive);
    if (videoActive && isPlaying) {
      // Pause background playlist track so video audio doesn't conflict
      setIsPlaying(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#070a10] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading Everly...</span>
        </div>
      </div>
    );
  }

  // 1. Strict Whitelist Check: Access Denied view
  if (deniedAttempt) {
    return (
      <AccessDenied
        attemptedEmail={deniedAttempt}
        onRetry={() => {
          clearDeniedAttempt();
          setDeniedAttempt(null);
        }}
      />
    );
  }

  // 2. Not logged in: Show Login Modal
  if (!currentUser) {
    return (
      <LoginModal
        initialEmail={loginTargetEmail}
        onLoginSuccess={handleLoginSuccess}
        onLoginDenied={handleLoginDenied}
      />
    );
  }


  const storageUsagePercent = Math.min(
    100,
    Number(((storageStats.usedBytes / storageStats.totalBytes) * 100).toFixed(1))
  );

  // Check if any foreground audio/video is playing
  const isForegroundMediaPlaying = isPlaying || isVideoPlaying;

  return (
    <div
      style={{ backgroundColor: activeTheme.colors.pageBg }}
      className="relative min-h-screen text-slate-200 selection:bg-rose-500/30 font-sans flex flex-col justify-between overflow-x-hidden transition-colors duration-500"
    >
      {/* Background Wallpaper Image (if enabled) */}
      <WallpaperBackground wallpaper={activeTheme.wallpaper} />

      {/* Background Starfield Particles */}
      <StarfieldParticles />

      {/* Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchAccount={handleInitiateSwitchUser}
        storageUsagePercent={storageUsagePercent}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenSoundtrackManager={() => setIsSoundtrackModalOpen(true)}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        onOpenStorageServers={() => setIsStorageServersModalOpen(true)}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Offline Network Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-500/20 border-y border-amber-500/30 text-amber-200 px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 relative z-20 backdrop-blur-md">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>You are currently offline. Showing cached Everly media and memories.</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Animated Hero Header with dynamic time-of-day greeting & live clock */}
        <HeroHeader
          currentUser={currentUser}
          stats={storageStats}
          onOpenStorageModal={() => setIsStorageModalOpen(true)}
          activeTab={currentTab}
        />

        {/* Google Drive Backup Status & Force Sync Widget */}
        <BackupStatusWidget
          className="mb-8"
          onFilesUpdated={async (syncedFiles) => {
            setFiles(syncedFiles);
            const stats = await computeEverlyStorageStats(syncedFiles);
            setStorageStats(stats);
          }}
        />

        {/* Daily Inspiration & Quote Card */}
        <DailyQuoteCard
          onOpenFavoritesModal={() => setIsFavoritesModalOpen(true)}
          className="mb-8"
        />

        {currentTab === 'moments' && (
          <PhotosTab
            files={files}
            currentUser={currentUser}
            onToggleFavorite={handleToggleFavorite}
            onRequestDelete={(file) => setDeleteTargetFile(file)}
            onOpenUpload={() => setCurrentTab('dropzone')}
          />
        )}

        {currentTab === 'cinema' && (
          <VideosTab
            files={files}
            currentUser={currentUser}
            onToggleFavorite={handleToggleFavorite}
            onRequestDelete={(file) => setDeleteTargetFile(file)}
            onOpenUpload={() => setCurrentTab('dropzone')}
            onVideoPlaybackChange={handleVideoPlaybackChange}
          />
        )}

        {currentTab === 'music' && (
          <MusicTab
            currentUser={currentUser}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={handlePlayTrack}
            onTogglePlay={handleTogglePlay}
            onRequestDelete={(file) => setDeleteTargetFile(file)}
          />
        )}

        {currentTab === 'vault' && (
          <DocumentsTab
            files={files}
            currentUser={currentUser}
            onToggleFavorite={handleToggleFavorite}
            onRequestDelete={(file) => setDeleteTargetFile(file)}
            onOpenUpload={() => setCurrentTab('dropzone')}
            onOpenThemeModal={() => setIsThemeModalOpen(true)}
          />
        )}

        {currentTab === 'board' && (
          <MemoryBoardTab currentUser={currentUser} />
        )}

        {currentTab === 'dropzone' && (
          <UploadCenterTab
            currentUser={currentUser}
            onUploadComplete={handleUploadFile}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onOpenStorageServers={() => setIsStorageServersModalOpen(true)}
          />
        )}

        {/* About Everly — A space for two friends */}
        <div className="mt-12 mb-4 p-6 sm:p-7 rounded-3xl bg-[#0b0f19]/80 border border-white/10 backdrop-blur-md shadow-xl text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>About Everly</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Everly is a personal space for two friends to keep their shared memories and meaningful moments together. It celebrates friendship, laughter, support and the little things worth remembering.
          </p>
        </div>
      </main>

      {/* Background Instrumental Music (Umbrella Theme) Player */}
      <BackgroundMusicPlayer
        isForegroundMediaPlaying={isForegroundMediaPlaying}
        onOpenSoundtrackManager={() => setIsSoundtrackModalOpen(true)}
      />

      {/* Persistent Floating Audio Bar at bottom for Playlist tracks */}
      <AudioPlayerBar
        currentTrack={currentTrack}
        playlist={audioPlaylist}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onTrackEnd={handleNextTrack}
        onPlaybackChange={(active) => setIsPlaying(active)}
      />

      {/* Storage Dashboard Modal */}
      <StorageModal
        stats={storageStats}
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        currentUser={currentUser}
        onOpenUpload={() => setCurrentTab('dropzone')}
        onRefreshStorage={() => {
          initEverlyCloudStorage().then(async (data) => {
            setFiles(data);
            const stats = await computeEverlyStorageStats(data);
            setStorageStats(stats);
          });
        }}
        onToggleDriveConnection={async (provider, isConnected) => {
          setDriveConnectionState(provider, isConnected);
          const stats = await computeEverlyStorageStats(files);
          setStorageStats(stats);
        }}
        onOpenStorageServers={() => setIsStorageServersModalOpen(true)}
        onSwitchAccount={handleInitiateSwitchUser}
      />

      {/* Admin Storage Servers Page / Modal (Media.cm, Everly, Local Disk, S3/R2) */}
      <StorageServersModal
        isOpen={isStorageServersModalOpen}
        onClose={() => setIsStorageServersModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Custom Soundtrack Manager Modal */}
      <SoundtrackManagerModal
        isOpen={isSoundtrackModalOpen}
        onClose={() => setIsSoundtrackModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Appearance & Custom Themes Studio Modal */}
      <ThemeAppearanceModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        onThemeChanged={(t) => setActiveThemeState(t)}
      />

      {/* Favorite Quotes Collection Modal */}
      <FavoriteQuotesModal
        isOpen={isFavoritesModalOpen}
        onClose={() => setIsFavoritesModalOpen(false)}
      />

      {/* Mandatory User Confirmation Dialog for Destructive Operations */}
      <ConfirmDeleteModal
        file={deleteTargetFile}
        isOpen={deleteTargetFile !== null}
        onClose={() => setDeleteTargetFile(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
