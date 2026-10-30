import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Music,
  Repeat,
  Radio,
  X,
  Disc,
} from 'lucide-react';
import {
  BackgroundTrack,
  formatAudioDuration,
  setBackgroundSong,
} from '../services/soundtrackService';

interface AudioPlayerBarProps {
  currentTrack: BackgroundTrack | any | null;
  playlist: BackgroundTrack[] | any[];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onTrackEnd: () => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
  onClose?: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  playlist,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onTrackEnd,
  onPlaybackChange,
  onClose,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set audio source when track changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    setErrorMsg(null);
    setCurrentTime(0);
    const playableUrl = currentTrack.url || '';

    audioRef.current.src = playableUrl;
    audioRef.current.volume = isMuted ? 0 : volume;

    if (isPlaying) {
      audioRef.current
        .play()
        .then(() => setErrorMsg(null))
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Playback error:', err);
          }
        });
    }
  }, [currentTrack]);

  // Sync Play / Pause state
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current
        .play()
        .then(() => setErrorMsg(null))
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Playback error:', err);
          }
        });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (isFinite(dur) && dur > 0) {
      setDuration(dur);
    } else if (currentTrack?.duration) {
      setDuration(currentTrack.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const handleEnded = () => {
    if (isLooping && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      onTrackEnd();
    }
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#070a12]/95 backdrop-blur-2xl border-t border-rose-500/25 px-4 py-3 sm:py-3.5 shadow-2xl animate-in slide-in-from-bottom-5">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setErrorMsg('Unable to play audio format.')}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Track info */}
        <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-rose-600/30 to-amber-500/30 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-md">
            <Disc className={`w-5 h-5 text-rose-300 ${isPlaying ? 'animate-spin' : ''}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                {currentTrack.title || currentTrack.name || 'Untitled Track'}
              </h4>
              {currentTrack.isBackground && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                  Background
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-2/4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Previous */}
            <button
              onClick={onPrev}
              disabled={playlist.length <= 1}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={onTogglePlay}
              className="w-10 h-10 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={onNext}
              disabled={playlist.length <= 1}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLooping ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-white'
              }`}
              title={isLooping ? 'Looping enabled' : 'Enable loop'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="w-full flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="w-10 text-right">{formatAudioDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || currentTrack.duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="w-10">{formatAudioDuration(duration || currentTrack.duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Background Action */}
        <div className="flex items-center justify-end gap-3 w-full md:w-1/4">
          {/* Set / Remove as Background */}
          {currentTrack.id && (
            <button
              onClick={() => setBackgroundSong(currentTrack.id)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                currentTrack.isBackground
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
              }`}
              title="Set as website background soundtrack"
            >
              <Radio className="w-3 h-3" />
              <span>{currentTrack.isBackground ? 'Background' : 'Set Background'}</span>
            </button>
          )}

          {/* Volume control */}
          <div className="flex items-center gap-2 max-w-[120px]">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4 text-slate-300" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-300" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
