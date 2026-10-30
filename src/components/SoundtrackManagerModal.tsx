import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Radio,
  Sparkles,
  Music,
  Upload,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Volume2,
  Sliders,
  Plus,
  Disc,
  Clock,
  RotateCcw,
} from 'lucide-react';
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
import { AuthorizedUser } from '../types';

interface SoundtrackManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthorizedUser;
}

type ModalTab = 'library' | 'upload' | 'settings';

export const SoundtrackManagerModal: React.FC<SoundtrackManagerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('library');
  const [musicState, setMusicState] = useState<BackgroundMusicState>(getBackgroundMusicState);
  const [library, setLibrary] = useState<BackgroundTrack[]>(getMusicLibrary);
  const [activeBgTrack, setActiveBgTrack] = useState<BackgroundTrack | null>(getActiveBackgroundTrack);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      return subscribeMusicLibrary((updatedLibrary, activeBg) => {
        setLibrary(updatedLibrary);
        setActiveBgTrack(activeBg);
        setMusicState(getBackgroundMusicState());
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const added = await uploadMultipleAudioTracks(files);
      if (added.length > 0) {
        showToast(`Added ${added.length} ${added.length === 1 ? 'song' : 'songs'} to your Music Library!`);
        setActiveTab('library');
      }
    } catch (err) {
      showToast('Error uploading audio file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleBackground = (track: BackgroundTrack) => {
    if (track.isBackground) {
      removeBackgroundSong();
      showToast('Removed background soundtrack');
    } else {
      setBackgroundSong(track.id);
      showToast(`Set "${track.title}" as background soundtrack!`);
    }
  };

  const handleDeleteSong = async (trackId: string) => {
    await deleteAudioTrack(trackId);
    showToast('Song deleted from library');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="soundtrack-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/mp3, audio/wav, audio/m4a, audio/aac, audio/ogg, audio/webm, audio/mpeg, .mp3, .wav, .m4a, .aac, .ogg, .webm"
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      <div
        className="relative w-full max-w-2xl my-6 bg-[#0c101b]/95 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-300">
              <Radio className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
                <span>Everly Music Studio</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <h2 id="soundtrack-modal-title" className="text-xl sm:text-2xl font-bold text-white">
                Background Music & Library
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {notification && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-4 flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Music Library ({library.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Upload Songs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* TAB 1: MUSIC LIBRARY */}
        {activeTab === 'library' && (
          <div className="mt-5 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {library.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <Music className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">No songs in library</p>
                <p className="text-[11px] text-slate-400">Click "+ Upload Songs" to add your audio files.</p>
              </div>
            ) : (
              library.map((track) => {
                const isBg = track.isBackground;
                return (
                  <div
                    key={track.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isBg
                        ? 'bg-rose-500/15 border-rose-500 ring-1 ring-rose-500/30'
                        : 'bg-[#0d1222]/80 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-rose-300">
                        <Disc className={`w-5 h-5 ${isBg ? 'animate-spin' : ''}`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                            {track.title}
                          </h4>
                          {isBg && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                              Background
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {track.artist || 'Unknown Artist'} · {formatAudioDuration(track.duration)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleBackground(track)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
                          isBg
                            ? 'bg-rose-600 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-slate-300'
                        }`}
                      >
                        {isBg ? 'Active Background' : 'Set as Background'}
                      </button>

                      <button
                        onClick={() => handleDeleteSong(track.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete song"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD */}
        {activeTab === 'upload' && (
          <div className="mt-5 space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-3xl border-2 border-dashed border-rose-500/30 hover:border-rose-500 bg-[#090e1a] text-center space-y-3 cursor-pointer group transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/20 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Click to Select Audio Files</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Upload MP3, WAV, M4A, AAC, OGG, or WEBM audio files
                </p>
              </div>
              <button
                type="button"
                disabled={isUploading}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isUploading ? 'Processing Songs...' : 'Browse Device Files'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="mt-5 space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {/* Background Music Toggle */}
            <div className="p-4 rounded-2xl bg-[#0e1322] border border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Background Music</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Play ambient soundtrack continuously while browsing Everly
                </p>
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
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Volume Slider */}
            <div className="p-4 rounded-2xl bg-[#0e1322] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Soundtrack Volume</span>
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
                  const val = parseFloat(e.target.value);
                  const updated = saveBackgroundMusicState({ volume: val, isMuted: false });
                  setMusicState(updated);
                }}
                className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
