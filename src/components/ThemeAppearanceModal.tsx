import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Check,
  RotateCcw,
  Image as ImageIcon,
  Upload,
  Sliders,
  Trash2,
  Plus,
  Eye,
  Layers,
  Heart,
  Radio,
  SlidersHorizontal,
  SunMedium,
  CheckCircle2,
  Disc,
} from 'lucide-react';
import {
  ThemePreset,
  ThemeColors,
  WallpaperConfig,
  BUILTIN_THEMES,
  DEFAULT_WALLPAPER,
  getActiveTheme,
  setActiveTheme,
  saveCustomTheme,
  deleteCustomTheme,
  getCustomThemes,
  resetThemeToDefault,
  processWallpaperFile,
} from '../services/themeService';
import {
  BackgroundTrack,
  BackgroundMusicState,
  getBackgroundMusicState,
  saveBackgroundMusicState,
  getMusicLibrary,
  subscribeMusicLibrary,
  uploadMultipleAudioTracks,
  deleteAudioTrack,
  setBackgroundSong,
  removeBackgroundSong,
  getActiveBackgroundTrack,
  formatAudioDuration,
} from '../services/soundtrackService';

interface ThemeAppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChanged?: (theme: ThemePreset) => void;
  initialTab?: 'presets' | 'custom' | 'wallpaper' | 'music';
}

type AppearanceTab = 'presets' | 'custom' | 'wallpaper' | 'music';

export const ThemeAppearanceModal: React.FC<ThemeAppearanceModalProps> = ({
  isOpen,
  onClose,
  onThemeChanged,
  initialTab = 'presets',
}) => {
  const [activeTab, setActiveTab] = useState<AppearanceTab>(initialTab);
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(getActiveTheme);
  const [customThemesList, setCustomThemesList] = useState<ThemePreset[]>(getCustomThemes);

  // Background Music state
  const [musicState, setMusicState] = useState<BackgroundMusicState>(getBackgroundMusicState);
  const [musicLibrary, setMusicLibrary] = useState<BackgroundTrack[]>(getMusicLibrary);
  const [activeBgSong, setActiveBgSong] = useState<BackgroundTrack | null>(getActiveBackgroundTrack);

  // Add music form state
  const [musicSourceType, setMusicSourceType] = useState<'drive' | 'upload' | 'url'>('drive');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('Everly Couple');
  const [driveSongInput, setDriveSongInput] = useState('');
  const [urlSongInput, setUrlSongInput] = useState('');
  const [driveError, setDriveError] = useState<string | null>(null);

  // Custom theme editor state
  const [themeName, setThemeName] = useState('My Custom Theme');
  const [editColors, setEditColors] = useState<ThemeColors>(() => currentTheme.colors);
  const [editWallpaper, setEditWallpaper] = useState<WallpaperConfig>(() => ({
    ...DEFAULT_WALLPAPER,
    ...(currentTheme.wallpaper || {}),
  }));

  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      const active = getActiveTheme();
      setCurrentTheme(active);
      setEditColors(active.colors);
      setEditWallpaper({
        ...DEFAULT_WALLPAPER,
        ...(active.wallpaper || {}),
      });
      setThemeName(active.isBuiltin ? `${active.name} Custom` : active.name);
      setCustomThemesList(getCustomThemes());
      setMusicState(getBackgroundMusicState());
      setMusicLibrary(getMusicLibrary());
      setActiveBgSong(getActiveBackgroundTrack());
      setNotification(null);
      setDriveError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSelectPreset = (preset: ThemePreset) => {
    const applied = setActiveTheme(preset);
    setCurrentTheme(applied);
    setEditColors(applied.colors);
    setEditWallpaper({
      ...DEFAULT_WALLPAPER,
      ...(applied.wallpaper || {}),
    });
    onThemeChanged?.(applied);
    showToast(`Switched to ${preset.name} theme`);
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const updated = {
      ...editColors,
      [key]: value,
    };
    setEditColors(updated);

    // Live preview update
    const previewTheme: ThemePreset = {
      ...currentTheme,
      colors: updated,
      wallpaper: editWallpaper,
    };
    setActiveTheme(previewTheme);
  };

  const handleWallpaperChange = (key: keyof WallpaperConfig, value: any) => {
    const updated = {
      ...editWallpaper,
      [key]: value,
    };
    setEditWallpaper(updated);

    const previewTheme: ThemePreset = {
      ...currentTheme,
      colors: editColors,
      wallpaper: updated,
    };
    setActiveTheme(previewTheme);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processWallpaperFile(file);
      const updatedWallpaper: WallpaperConfig = {
        ...editWallpaper,
        enabled: true,
        imageUrl: dataUrl,
      };
      setEditWallpaper(updatedWallpaper);

      const previewTheme: ThemePreset = {
        ...currentTheme,
        colors: editColors,
        wallpaper: updatedWallpaper,
      };
      setActiveTheme(previewTheme);
      showToast('Wallpaper loaded successfully!');
    } catch (err) {
      console.error('Error processing wallpaper image:', err);
      showToast('Failed to load image. Please try another format.');
    }
  };

  const handleRemoveWallpaper = () => {
    const cleared: WallpaperConfig = {
      ...DEFAULT_WALLPAPER,
      enabled: false,
      imageUrl: '',
    };
    setEditWallpaper(cleared);
    const previewTheme: ThemePreset = {
      ...currentTheme,
      colors: editColors,
      wallpaper: cleared,
    };
    setActiveTheme(previewTheme);
    showToast('Background image removed');
  };

  const handleSaveCustomTheme = () => {
    const cleanName = themeName.trim() || 'My Theme';
    const id = currentTheme.isBuiltin
      ? `custom-${Date.now()}`
      : currentTheme.id.startsWith('custom-')
      ? currentTheme.id
      : `custom-${Date.now()}`;

    const newTheme: ThemePreset = {
      id,
      name: cleanName,
      description: 'Personalized color palette & background theme.',
      badge: 'Custom',
      isBuiltin: false,
      colors: editColors,
      wallpaper: editWallpaper,
    };

    const saved = saveCustomTheme(newTheme);
    setCurrentTheme(saved);
    setCustomThemesList(getCustomThemes());
    onThemeChanged?.(saved);
    showToast(`Saved theme "${cleanName}"!`);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomTheme(id);
    setCustomThemesList(getCustomThemes());
    const fallback = getActiveTheme();
    setCurrentTheme(fallback);
    setEditColors(fallback.colors);
    setEditWallpaper({ ...DEFAULT_WALLPAPER, ...(fallback.wallpaper || {}) });
    showToast('Custom theme deleted');
  };

  const handleResetDefaults = () => {
    const fresh = resetThemeToDefault();
    setCurrentTheme(fresh);
    setEditColors(fresh.colors);
    setEditWallpaper({ ...DEFAULT_WALLPAPER });
    onThemeChanged?.(fresh);
    showToast('Reset to Midnight theme');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl my-6 bg-[#0c101b]/95 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-indigo-500/20 border border-rose-500/30 text-rose-300 shadow-inner">
              <Palette className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
                <span>Everly Personalization</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <h2 id="theme-modal-title" className="text-xl sm:text-2xl font-bold text-white">
                Appearance & Theme Studio
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize preset styles, bespoke color palettes, and full wallpaper backgrounds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close theme studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast feedback */}
        {notification && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-5 flex items-center gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Preset Themes ({BUILTIN_THEMES.length + customThemesList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'custom'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Custom Colors</span>
          </button>

          <button
            onClick={() => setActiveTab('wallpaper')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'wallpaper'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Wallpaper</span>
          </button>

          <button
            onClick={() => setActiveTab('music')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'music'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Background Music</span>
          </button>
        </div>

        {/* TAB 1: PRESETS */}
        {activeTab === 'presets' && (
          <div className="mt-6 space-y-6 max-h-[55vh] overflow-y-auto pr-1">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Built-In Curated Themes
                </span>
                <span className="text-[11px] text-slate-400">Select to activate immediately</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {BUILTIN_THEMES.map((theme) => {
                  const isActive = currentTheme.id === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectPreset(theme)}
                      className={`group p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                        isActive
                          ? 'bg-white/10 border-rose-500 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500'
                          : 'bg-[#0e121e]/80 border-white/10 hover:border-white/20 hover:bg-[#151a2b]'
                      }`}
                    >
                      <div>
                        {/* Header & badge */}
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-sm text-white group-hover:text-rose-200 transition-colors">
                            {theme.name}
                          </span>
                          {theme.badge && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {theme.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {theme.description}
                        </p>
                      </div>

                      {/* Color palette chips */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: theme.colors.pageBg }}
                            title="Page Bg"
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: theme.colors.cardBg }}
                            title="Card Bg"
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: theme.colors.primaryAccent }}
                            title="Primary Accent"
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: theme.colors.secondaryAccent }}
                            title="Secondary Accent"
                          />
                        </div>

                        {isActive ? (
                          <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-300">
                            Apply
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Saved Themes Section */}
            {customThemesList.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Your Custom Themes ({customThemesList.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Created by you</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customThemesList.map((theme) => {
                    const isActive = currentTheme.id === theme.id;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => handleSelectPreset(theme)}
                        className={`group p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isActive
                            ? 'bg-white/10 border-rose-500 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500'
                            : 'bg-[#0e121e]/80 border-white/10 hover:border-white/20 hover:bg-[#151a2b]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-white">{theme.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Custom
                            </span>
                            <button
                              onClick={(e) => handleDeleteCustom(theme.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors"
                              title="Delete theme"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Chips */}
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-4 h-4 rounded-full border border-white/20"
                              style={{ backgroundColor: theme.colors.pageBg }}
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-white/20"
                              style={{ backgroundColor: theme.colors.primaryAccent }}
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-white/20"
                              style={{ backgroundColor: theme.colors.secondaryAccent }}
                            />
                            {theme.wallpaper?.enabled && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <ImageIcon className="w-3 h-3 text-rose-400" />
                              </span>
                            )}
                          </div>

                          {isActive && (
                            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CUSTOM COLOR DESIGNER */}
        {activeTab === 'custom' && (
          <div className="mt-6 space-y-6 max-h-[55vh] overflow-y-auto pr-1">
            {/* Theme Name input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Custom Theme Name
                </label>
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="e.g. My Night, Galaxy, Our Memory Theme"
                  className="w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCustomTheme}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md shadow-rose-950/40 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Theme</span>
                </button>
              </div>
            </div>

            {/* Color Role Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Page Background */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Page Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.pageBg}
                    onChange={(e) => handleColorChange('pageBg', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.pageBg}
                    onChange={(e) => handleColorChange('pageBg', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Card / Surface Background */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Card / Surface Bg
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.cardBg.startsWith('#') ? editColors.cardBg : '#121624'}
                    onChange={(e) => handleColorChange('cardBg', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.cardBg}
                    onChange={(e) => handleColorChange('cardBg', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Primary Accent Color */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Primary Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.primaryAccent}
                    onChange={(e) => handleColorChange('primaryAccent', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.primaryAccent}
                    onChange={(e) => handleColorChange('primaryAccent', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Secondary Accent Color */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Secondary Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.secondaryAccent}
                    onChange={(e) => handleColorChange('secondaryAccent', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.secondaryAccent}
                    onChange={(e) => handleColorChange('secondaryAccent', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Main Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.textColor}
                    onChange={(e) => handleColorChange('textColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.textColor}
                    onChange={(e) => handleColorChange('textColor', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Muted Text Color */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Muted Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.mutedTextColor}
                    onChange={(e) => handleColorChange('mutedTextColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.mutedTextColor}
                    onChange={(e) => handleColorChange('mutedTextColor', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Button Color */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Button Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.buttonColor}
                    onChange={(e) => handleColorChange('buttonColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.buttonColor}
                    onChange={(e) => handleColorChange('buttonColor', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Border / Glow Color */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Border / Glow Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColors.glowColor.startsWith('#') ? editColors.glowColor : '#f43f5e'}
                    onChange={(e) => {
                      handleColorChange('glowColor', e.target.value);
                      handleColorChange('borderColor', `${e.target.value}55`);
                    }}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editColors.glowColor}
                    onChange={(e) => handleColorChange('glowColor', e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Live Mini Preview Box */}
            <div className="p-4 rounded-3xl border border-white/10 space-y-3 bg-black/30">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300">
                  <Eye className="w-4 h-4 text-rose-400" />
                  <span>Real-Time UI Preview</span>
                </span>
                <span>Updates live as you tweak colors</span>
              </div>

              <div
                style={{
                  backgroundColor: editColors.pageBg,
                  color: editColors.textColor,
                  borderColor: editColors.borderColor,
                }}
                className="p-5 rounded-2xl border shadow-xl space-y-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        backgroundColor: `${editColors.primaryAccent}25`,
                        color: editColors.primaryAccent,
                        borderColor: `${editColors.primaryAccent}50`,
                      }}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                    >
                      Theme Preview
                    </span>
                    <span style={{ color: editColors.mutedTextColor }} className="text-xs">
                      Live Sample
                    </span>
                  </div>

                  <button
                    style={{
                      backgroundColor: editColors.buttonColor,
                      color: editColors.buttonTextColor,
                    }}
                    className="px-3 py-1 rounded-xl text-xs font-semibold shadow-md cursor-pointer"
                  >
                    Action Button
                  </button>
                </div>

                <div
                  style={{
                    backgroundColor: editColors.cardBg,
                    borderColor: editColors.borderColor,
                  }}
                  className="p-3.5 rounded-xl border flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold" style={{ color: editColors.textColor }}>
                      Card Component
                    </h4>
                    <p className="text-[11px]" style={{ color: editColors.mutedTextColor }}>
                      Subtext and metadata appear with elegant contrast.
                    </p>
                  </div>
                  <span
                    style={{
                      color: editColors.secondaryAccent,
                    }}
                    className="text-xs font-mono font-bold"
                  >
                    +24.5% Accent
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WALLPAPER IMAGE */}
        {activeTab === 'wallpaper' && (
          <div className="mt-6 space-y-6 max-h-[55vh] overflow-y-auto pr-1">
            {/* Upload Box */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-rose-400" />
                    <span>Upload Custom Background Image</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Supports JPG, PNG, WEBP, and modern image formats.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose Image File</span>
                  </button>

                  {editWallpaper.imageUrl && (
                    <button
                      onClick={handleRemoveWallpaper}
                      className="px-3 py-2.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Wallpaper toggle switch */}
              {editWallpaper.imageUrl && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
                  <span className="text-xs font-medium text-slate-300">
                    Enable Background Image
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editWallpaper.enabled}
                      onChange={(e) => handleWallpaperChange('enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>
              )}
            </div>

            {/* Adjustments: Blur, Darkness, Opacity, Position */}
            {editWallpaper.imageUrl && (
              <div className="p-5 rounded-3xl bg-[#090d18]/80 border border-white/10 space-y-5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Image Adjustments & Overlay Controls
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Darkness / Overlay Darkness */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Darkness Overlay</span>
                      <span className="font-mono text-rose-400 font-bold">
                        {editWallpaper.darkness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={95}
                      value={editWallpaper.darkness}
                      onChange={(e) => handleWallpaperChange('darkness', parseInt(e.target.value))}
                      className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Controls dark tint so text stays crisp
                    </span>
                  </div>

                  {/* Blur */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Background Blur</span>
                      <span className="font-mono text-rose-400 font-bold">
                        {editWallpaper.blur}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={editWallpaper.blur}
                      onChange={(e) => handleWallpaperChange('blur', parseInt(e.target.value))}
                      className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Softens wallpaper background focus
                    </span>
                  </div>

                  {/* Opacity */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Image Opacity</span>
                      <span className="font-mono text-rose-400 font-bold">
                        {editWallpaper.opacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editWallpaper.opacity}
                      onChange={(e) => handleWallpaperChange('opacity', parseInt(e.target.value))}
                      className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Positioning & Fit */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-300 block">
                      Position & Alignment
                    </span>
                    <div className="flex items-center gap-2">
                      {(['center', 'top', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => handleWallpaperChange('position', pos)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-medium capitalize border transition-colors cursor-pointer ${
                            editWallpaper.position === pos
                              ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Wallpaper Miniature Preview */}
                <div className="pt-3 border-t border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                    Wallpaper Miniature Preview
                  </span>
                  <div className="relative h-32 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                    <div
                      style={{
                        backgroundImage: `url(${editWallpaper.imageUrl})`,
                        backgroundPosition: editWallpaper.position,
                        backgroundSize: editWallpaper.size,
                        filter: editWallpaper.blur > 0 ? `blur(${editWallpaper.blur}px)` : 'none',
                        opacity: editWallpaper.opacity / 100,
                      }}
                      className="absolute inset-0"
                    />
                    <div
                      style={{
                        backgroundColor: `rgba(5, 8, 15, ${editWallpaper.darkness / 100})`,
                      }}
                      className="absolute inset-0"
                    />
                    <div className="relative z-10 px-4 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-semibold text-white shadow-xl">
                      Live Sample Preview Over Wallpaper
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BACKGROUND MUSIC */}
        {activeTab === 'music' && (
          <div className="mt-6 space-y-6 max-h-[55vh] overflow-y-auto pr-1">
            {/* Section 1: Current Background Song */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/40 via-[#0f1426]/90 to-amber-950/30 border border-rose-500/30 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Current Background Song
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeBgSong ? 'Active' : 'None'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-slate-800 flex items-center justify-center text-rose-300">
                    <Disc className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                      {activeBgSong?.title || 'No background song active'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeBgSong?.artist || 'Unknown Artist'} · {formatAudioDuration(activeBgSong?.duration || 0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                  >
                    + Upload Song
                  </button>

                  {activeBgSong && (
                    <button
                      onClick={() => {
                        removeBackgroundSong();
                        setActiveBgSong(null);
                        showToast('Removed background soundtrack');
                      }}
                      className="px-3 py-2 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Remove Background
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Hidden audio file picker */}
            <input
              ref={audioInputRef}
              type="file"
              multiple
              accept="audio/mp3, audio/wav, audio/m4a, audio/aac, audio/ogg, audio/webm, audio/mpeg, .mp3, .wav, .m4a, .aac, .ogg, .webm"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const added = await uploadMultipleAudioTracks(e.target.files);
                  if (added.length > 0) {
                    setMusicLibrary(getMusicLibrary());
                    setActiveBgSong(getActiveBackgroundTrack());
                    showToast(`Uploaded ${added.length} songs to library!`);
                  }
                }
              }}
              className="hidden"
            />

            {/* Section 2: Music Library List */}
            <div className="p-5 rounded-3xl bg-[#0a0e19]/90 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-slate-300">
                  Background Music Library ({musicLibrary.length})
                </span>
                <span>Click track to set active</span>
              </div>

              <div className="space-y-2">
                {musicLibrary.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-white/5 text-xs text-slate-400">
                    No songs uploaded yet. Click "+ Upload Song" above.
                  </div>
                ) : (
                  musicLibrary.map((track) => {
                    const isActive = activeBgSong?.id === track.id;
                    return (
                      <div
                        key={track.id}
                        onClick={() => {
                          setBackgroundSong(track.id);
                          setActiveBgSong(track);
                          showToast(`Set "${track.title}" as background song`);
                        }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isActive
                            ? 'bg-rose-500/20 border-rose-500 shadow-md ring-1 ring-rose-500'
                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 text-rose-300">
                            <Disc className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {track.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {track.artist || 'Unknown Artist'} · {formatAudioDuration(track.duration)}
                            </div>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-rose-600 text-white">
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 hover:text-white">
                            Select
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section 3: Music Settings (ON/OFF, Volume slider) */}
            <div className="p-5 rounded-3xl bg-[#0a0e19]/90 border border-white/10 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Music Settings & Volume
              </span>

              {/* Background Music Toggle */}
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white block">Background Music</span>
                  <span className="text-[11px] text-slate-400">Enable ambient soundtrack</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={musicState.musicEnabled}
                    onChange={(e) => {
                      const updated = saveBackgroundMusicState({ musicEnabled: e.target.checked });
                      setMusicState(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Soundtrack Volume</span>
                  <span className="font-mono text-rose-400 font-bold">
                    {Math.round(musicState.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={musicState.volume}
                  onChange={(e) => {
                    const newVol = parseFloat(e.target.value);
                    const updated = saveBackgroundMusicState({ volume: newVol, isMuted: false });
                    setMusicState(updated);
                  }}
                  className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
          <button
            onClick={handleResetDefaults}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Midnight Theme</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Done / Close
            </button>
            <button
              onClick={() => {
                handleSaveCustomTheme();
                onClose();
              }}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Apply & Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
