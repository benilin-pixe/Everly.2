import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music2,
  Disc,
  Radio,
  Sparkles,
  AlertCircle,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import {
  BackgroundTrack,
  BackgroundMusicState,
  getBackgroundMusicState,
  saveBackgroundMusicState,
  getMusicLibrary,
  subscribeMusicLibrary,
  getActiveBackgroundTrack,
  formatAudioDuration,
  setBackgroundSong,
} from '../services/soundtrackService';

interface BackgroundMusicPlayerProps {
  isForegroundMediaPlaying?: boolean;
  onOpenSoundtrackManager?: () => void;
}

export const BackgroundMusicPlayer: React.FC<BackgroundMusicPlayerProps> = ({
  isForegroundMediaPlaying = false,
  onOpenSoundtrackManager,
}) => {
  const [musicState, setMusicState] = useState<BackgroundMusicState>(getBackgroundMusicState);
  const [library, setLibrary] = useState<BackgroundTrack[]>(getMusicLibrary);
  const [currentTrack, setCurrentTrack] = useState<BackgroundTrack | null>(getActiveBackgroundTrack);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAutoplayPrompt, setShowAutoplayPrompt] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Subscribe to live audio library & active background track
  useEffect(() => {
    return subscribeMusicLibrary((updatedLibrary, activeBg) => {
      setLibrary(updatedLibrary);
      setCurrentTrack(activeBg);
      setMusicState(getBackgroundMusicState());
    });
  }, []);

  // Update audio source when active track changes
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    if (!currentTrack || !currentTrack.url) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    setErrorMsg(null);
    audio.src = currentTrack.url;
    audio.loop = musicState.loop;
    audio.volume = musicState.isMuted ? 0 : musicState.volume;

    if (musicState.musicEnabled && !isForegroundMediaPlaying) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setShowAutoplayPrompt(false);
        })
        .catch((err) => {
          if (err.name === 'NotAllowedError') {
            setShowAutoplayPrompt(true);
            setIsPlaying(false);
          } else if (err.name !== 'AbortError') {
            console.warn('Background audio playback error:', err);
          }
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack, musicState.musicEnabled]);

  // Foreground Media Ducking
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    if (isForegroundMediaPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else if (musicState.musicEnabled && currentTrack && isPlaying) {
      audio.play().catch(() => {});
    }
  }, [isForegroundMediaPlaying]);

  // Volume & Mute Sync
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = musicState.isMuted ? 0 : musicState.volume;
  }, [musicState.volume, musicState.isMuted]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    if (!isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTrackEnded = () => {
    if (musicState.loop) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      handleNextTrack();
    }
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      saveBackgroundMusicState({ musicEnabled: false });
    } else {
      setErrorMsg(null);
      saveBackgroundMusicState({ musicEnabled: true });
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setShowAutoplayPrompt(false);
        })
        .catch((err) => {
          if (err.name === 'NotAllowedError') {
            setShowAutoplayPrompt(true);
          } else {
            setErrorMsg('Unable to play audio format.');
          }
        });
    }
  }, [isPlaying, currentTrack]);

  const handlePrevTrack = () => {
    if (library.length <= 1 || !currentTrack) return;
    const idx = library.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + library.length) % library.length;
    const prev = library[prevIdx];
    if (prev) {
      setBackgroundSong(prev.id);
    }
  };

  const handleNextTrack = () => {
    if (library.length <= 1 || !currentTrack) return;
    const idx = library.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % library.length;
    const next = library[nextIdx];
    if (next) {
      setBackgroundSong(next.id);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    saveBackgroundMusicState({ volume: val, isMuted: false });
  };

  const toggleMute = () => {
    saveBackgroundMusicState({ isMuted: !musicState.isMuted });
  };

  const handleEnableMusic = () => {
    setShowAutoplayPrompt(false);
    saveBackgroundMusicState({ musicEnabled: true });
    if (audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleTrackEnded}
        onError={() => setErrorMsg('Unable to play audio file.')}
        preload="auto"
      />

      {/* Autoplay First-Visit Banner */}
      {showAutoplayPrompt && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 max-w-sm p-4 rounded-3xl bg-[#0e1222]/95 border border-rose-500/40 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <Music2 className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Background Music
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Enable ambient background soundtrack for Everly?
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleEnableMusic}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  Enable Music
                </button>
                <button
                  onClick={() => setShowAutoplayPrompt(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Background Player Widget */}
      <div className="fixed bottom-3 left-3 sm:left-6 z-40 max-w-[95vw] sm:max-w-md select-none transition-all duration-300">
        {errorMsg && (
          <div className="mb-2 p-2.5 rounded-2xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-[11px] leading-tight">{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:text-white rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-2 sm:p-2.5 rounded-2xl bg-[#090d19]/90 backdrop-blur-xl border border-rose-500/20 hover:border-rose-500/40 shadow-2xl transition-all">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Vinyl Disc Icon */}
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-white/10 cursor-pointer shrink-0 group bg-gradient-to-br from-rose-950/80 to-[#121626] flex items-center justify-center text-rose-300"
              title="Click to toggle expanded controls"
            >
              <Disc className={`w-6 h-6 ${isPlaying ? 'animate-spin' : ''}`} />
              {isPlaying && (
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>

            {/* Track Info */}
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                  Background
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[170px]">
                  {currentTrack.title}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {currentTrack.artist || 'Unknown Artist'}
              </div>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handlePrevTrack}
                disabled={library.length <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 hover:bg-white/5 transition-colors cursor-pointer"
                title="Previous track"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePlay}
                className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-md shadow-rose-950/50 transition-transform active:scale-95 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                onClick={handleNextTrack}
                disabled={library.length <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 hover:bg-white/5 transition-colors cursor-pointer"
                title="Next track"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              {onOpenSoundtrackManager && (
                <button
                  onClick={onOpenSoundtrackManager}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Open Music Library"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Expanded Scrubber & Volume Drawer */}
          {isExpanded && (
            <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={duration || currentTrack.duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{formatAudioDuration(currentTime)}</span>
                  <span>{formatAudioDuration(duration || currentTrack.duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                  <button
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {musicState.isMuted || musicState.volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={musicState.isMuted ? 0 : musicState.volume}
                    onChange={handleVolumeChange}
                    className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => saveBackgroundMusicState({ loop: !musicState.loop })}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                      musicState.loop
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    Loop
                  </button>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {library.length} songs
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
