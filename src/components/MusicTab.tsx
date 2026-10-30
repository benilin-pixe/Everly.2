import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Upload,
  Music,
  Trash2,
  CheckCircle2,
  Clock,
  Radio,
  Sparkles,
  Volume2,
  Plus,
  Disc,
  FileAudio,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  BackgroundTrack,
  getMusicLibrary,
  subscribeMusicLibrary,
  uploadMultipleAudioTracks,
  deleteAudioTrack,
  setBackgroundSong,
  removeBackgroundSong,
  getActiveBackgroundTrack,
  formatAudioDuration,
} from '../services/soundtrackService';
import { MediaFile, AuthorizedUser } from '../types';

interface MusicTabProps {
  currentUser: AuthorizedUser;
  currentTrack: MediaFile | BackgroundTrack | null;
  isPlaying: boolean;
  onPlayTrack: (track: any) => void;
  onTogglePlay: () => void;
  onRequestDelete?: (file: any) => void;
}

export const MusicTab: React.FC<MusicTabProps> = ({
  currentUser,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
}) => {
  const [library, setLibrary] = useState<BackgroundTrack[]>(getMusicLibrary);
  const [activeBgTrack, setActiveBgTrack] = useState<BackgroundTrack | null>(getActiveBackgroundTrack);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to live audio library updates
  useEffect(() => {
    return subscribeMusicLibrary((updatedLibrary, activeBg) => {
      setLibrary(updatedLibrary);
      setActiveBgTrack(activeBg);
    });
  }, []);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const added = await uploadMultipleAudioTracks(files);
      if (added.length > 0) {
        setUploadMessage(`Successfully added ${added.length} ${added.length === 1 ? 'song' : 'songs'} to your Music Library!`);
        setTimeout(() => setUploadMessage(null), 4000);

        // Auto-play the first uploaded song if nothing is playing
        if (!currentTrack) {
          onPlayTrack(added[0]);
        }
      }
    } catch (err) {
      console.warn('Upload error:', err);
      setUploadMessage('Failed to process some audio files. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleDeleteSong = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteAudioTrack(trackId);
  };

  const handleToggleBackground = (track: BackgroundTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (track.isBackground) {
      removeBackgroundSong();
    } else {
      setBackgroundSong(track.id);
    }
  };

  return (
    <div className="space-y-6 pb-28 max-w-5xl mx-auto animate-fade-in">
      {/* Hidden File Input for Device Audio Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/mp3, audio/wav, audio/m4a, audio/aac, audio/ogg, audio/webm, audio/mpeg, .mp3, .wav, .m4a, .aac, .ogg, .webm"
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Music Library</span>
              <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                {library.length} {library.length === 1 ? 'song' : 'songs'}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload your favorite songs, play anytime, and set your romantic background soundtrack.
          </p>
        </div>

        {/* Prominent Upload Song Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{isUploading ? 'Reading Audio...' : '+ Upload Song'}</span>
        </button>
      </div>

      {/* Upload Notification Toast */}
      {uploadMessage && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{uploadMessage}</span>
          </div>
          <button
            onClick={() => setUploadMessage(null)}
            className="p-1 hover:text-white rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag & Drop Quick Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 sm:p-8 rounded-3xl border-2 border-dashed transition-all text-center cursor-pointer group ${
          dragActive
            ? 'border-rose-500 bg-rose-500/10 scale-[1.01]'
            : 'border-white/10 hover:border-rose-500/40 bg-[#0c101c]/80 hover:bg-[#121727]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
          <Upload className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors">
          Click or drag & drop audio files here
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Supports <span className="text-slate-300 font-semibold">MP3, WAV, M4A, AAC, OGG, WEBM</span> · Select multiple songs at once
        </p>
      </div>

      {/* MUSIC LIBRARY LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-bold uppercase tracking-wider text-slate-300">
            All Songs ({library.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Click any song to play
          </span>
        </div>

        {/* Empty State */}
        {library.length === 0 && !isUploading && (
          <div className="p-10 rounded-3xl bg-[#0c101c]/60 border border-white/5 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 text-slate-400 mx-auto flex items-center justify-center">
              <FileAudio className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">No songs uploaded yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your Music Library is empty. Click "+ Upload Song" above to upload and play your couple songs.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              + Upload First Song
            </button>
          </div>
        )}

        {/* Song Cards List */}
        <div className="space-y-2">
          {library.map((track, idx) => {
            const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;
            const isThisTrackActive = currentTrack?.id === track.id;

            return (
              <div
                key={track.id}
                onClick={() => {
                  if (isThisTrackActive) {
                    onTogglePlay();
                  } else {
                    onPlayTrack(track);
                  }
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                  isThisTrackActive
                    ? 'bg-rose-500/15 border-rose-500/60 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/40'
                    : 'bg-[#0b0f1b]/90 border-white/10 hover:border-white/20 hover:bg-[#111728]'
                }`}
              >
                {/* Left: Play Button, Index & Song Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Play / Pause button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isThisTrackActive) {
                        onTogglePlay();
                      } else {
                        onPlayTrack(track);
                      }
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md cursor-pointer ${
                      isThisTrackActive
                        ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white'
                        : 'bg-white/10 group-hover:bg-rose-600 text-slate-200 group-hover:text-white'
                    }`}
                    title={isThisTrackPlaying ? 'Pause' : 'Play'}
                  >
                    {isThisTrackPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Metadata */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-rose-200 transition-colors">
                        {track.title}
                      </h4>
                      {track.format && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-white/5 text-slate-400 border border-white/10 shrink-0">
                          {track.format}
                        </span>
                      )}
                      {track.isBackground && (
                        <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5" />
                          <span>Active Background</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 truncate">
                      <span className="truncate">{track.artist || 'Unknown Artist'}</span>
                      {track.album && <span>• {track.album}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Duration & Actions */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {/* Duration */}
                  <div className="flex items-center gap-1 text-xs font-mono font-semibold text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatAudioDuration(track.duration)}</span>
                  </div>

                  {/* Set / Remove Background Button */}
                  <button
                    onClick={(e) => handleToggleBackground(track, e)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      track.isBackground
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
                    }`}
                    title={track.isBackground ? 'Remove from background music' : 'Set as website background music'}
                  >
                    <Radio className="w-3 h-3" />
                    <span className="hidden sm:inline">
                      {track.isBackground ? 'Remove Background' : 'Set as Background'}
                    </span>
                  </button>

                  {/* Delete Song */}
                  <button
                    onClick={(e) => handleDeleteSong(track.id, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete song"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
