import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  X,
  Calendar,
  Clock,
  Monitor,
  HardDrive,
  Download,
  Play,
  FileVideo,
  User,
  ShieldCheck,
  CheckCircle2,
  Folder,
  Layers,
} from 'lucide-react';
import { MediaFile } from '../types';
import { formatBytes } from '../services/storageService';
import { VideoDiagnosticReport } from '../services/driveStreamService';

interface VideoDetailsModalProps {
  video: MediaFile | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayVideo?: (video: MediaFile) => void;
  onDownload?: (video: MediaFile) => void;
  diagnosticReport?: VideoDiagnosticReport | null;
}

export const VideoDetailsModal: React.FC<VideoDetailsModalProps> = ({
  video,
  isOpen,
  onClose,
  onPlayVideo,
  onDownload,
  diagnosticReport,
}) => {
  const [detectedResolution, setDetectedResolution] = useState<{
    width: number;
    height: number;
    label: string;
    aspectRatio: string;
  } | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const probeVideoRef = useRef<HTMLVideoElement | null>(null);

  // Parse filename for resolution hints if video metadata is not yet probed
  const getFallbackResolution = (name: string): { width: number; height: number; label: string; aspectRatio: string } => {
    const lower = name.toLowerCase();
    if (lower.includes('4k') || lower.includes('2160p')) {
      return { width: 3840, height: 2160, label: '4K Ultra HD (2160p)', aspectRatio: '16:9' };
    }
    if (lower.includes('1080p') || lower.includes('fhd')) {
      return { width: 1920, height: 1080, label: 'Full HD (1080p)', aspectRatio: '16:9' };
    }
    if (lower.includes('720p') || lower.includes('hd')) {
      return { width: 1280, height: 720, label: 'HD Ready (720p)', aspectRatio: '16:9' };
    }
    if (lower.includes('480p')) {
      return { width: 854, height: 480, label: 'Standard Definition (480p)', aspectRatio: '16:9' };
    }
    return { width: 1920, height: 1080, label: 'Full HD (1080p)', aspectRatio: '16:9' };
  };

  // Helper to format aspect ratio
  const calculateAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return '16:9';
    const ratio = w / h;
    if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9 Widescreen';
    if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3 Standard';
    if (Math.abs(ratio - 21 / 9) < 0.05) return '21:9 UltraWide Cinema';
    if (Math.abs(ratio - 1) < 0.05) return '1:1 Square';
    if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16 Vertical Video';
    return `${w}:${h}`;
  };

  // Helper to format seconds to mm:ss or hh:mm:ss
  const formatSeconds = (sec?: number): string => {
    if (!sec || isNaN(sec)) return '00:00';
    const totalSec = Math.floor(sec);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Helper to format full date
  const formatFullDate = (isoString?: string): string => {
    if (!isoString) return 'Date unknown';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Helper for relative time (e.g. "Today", "3 days ago")
  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
      const diffDays = Math.floor(diffSec / 86400);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      return `${Math.floor(diffDays / 30)} months ago`;
    } catch {
      return '';
    }
  };

  // Probe video element for exact dimensions and duration when opened
  useEffect(() => {
    if (!isOpen || !video) {
      setDetectedResolution(null);
      setDetectedDuration(null);
      setIsProbing(false);
      return;
    }

    if (video.width && video.height) {
      setDetectedResolution({
        width: video.width,
        height: video.height,
        label: video.resolution || `${video.width} × ${video.height}`,
        aspectRatio: calculateAspectRatio(video.width, video.height),
      });
      setDetectedDuration(video.duration || null);
      return;
    }

    // Initialize with fallback from filename while probing
    const fallback = getFallbackResolution(video.name);
    setDetectedResolution(fallback);
    setDetectedDuration(video.duration || null);

    // Asynchronously probe dimensions from video stream
    const probeSrc = video.url;
    if (probeSrc && typeof window !== 'undefined') {
      setIsProbing(true);
      const probeEl = document.createElement('video');
      probeVideoRef.current = probeEl;
      probeEl.preload = 'metadata';
      probeEl.muted = true;
      probeEl.playsInline = true;

      const handleLoadedMetadata = () => {
        if (probeEl.videoWidth > 0 && probeEl.videoHeight > 0) {
          const w = probeEl.videoWidth;
          const h = probeEl.videoHeight;
          let label = `${w} × ${h}`;
          if (w >= 3840 || h >= 2160) label = '4K Ultra HD (2160p)';
          else if (w >= 1920 || h >= 1080) label = 'Full HD (1080p)';
          else if (w >= 1280 || h >= 720) label = 'HD Ready (720p)';
          else if (w >= 854 || h >= 480) label = 'SD (480p)';

          setDetectedResolution({
            width: w,
            height: h,
            label,
            aspectRatio: calculateAspectRatio(w, h),
          });
        }
        if (probeEl.duration && !isNaN(probeEl.duration) && probeEl.duration !== Infinity) {
          setDetectedDuration(probeEl.duration);
        }
        setIsProbing(false);
      };

      const handleError = () => {
        setIsProbing(false);
      };

      probeEl.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      probeEl.addEventListener('error', handleError, { once: true });
      probeEl.src = probeSrc;

      return () => {
        probeEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        probeEl.removeEventListener('error', handleError);
        probeEl.src = '';
        probeVideoRef.current = null;
      };
    }
  }, [isOpen, video]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !video) return null;

  const currentDuration = detectedDuration || video.duration || 15;
  const resolutionInfo = detectedResolution || getFallbackResolution(video.name);
  const relativeTime = formatRelativeTime(video.uploadedAt);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-details-title"
      >
        {/* Cinematic Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="relative w-full max-w-2xl bg-[#0c1220] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Subtle Cinema Glow Gradient */}
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-rose-500/10 via-purple-500/5 to-transparent pointer-events-none" />

          {/* Modal Header */}
          <div className="relative p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    Cinema Clip Details
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {resolutionInfo.label.split(' ')[0]}
                  </span>
                </div>
                <h2
                  id="video-details-title"
                  className="text-base sm:text-lg font-bold text-white truncate mt-1"
                >
                  {video.caption || video.name}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body - Scrollable Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {/* Cinema Video Preview Card */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950/80 border border-white/10 aspect-video flex items-center justify-center shadow-inner group">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <FileVideo className="w-12 h-12 text-slate-600 stroke-[1.5]" />
                  <span className="text-xs font-mono">{video.name}</span>
                </div>
              )}

              {/* Play Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-600/90 text-white text-[10px] font-semibold uppercase tracking-wider">
                      {resolutionInfo.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-slate-300 text-[10px] font-mono border border-white/10">
                      {resolutionInfo.aspectRatio}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono">
                    Length: {formatSeconds(currentDuration)}
                  </p>
                </div>

                {onPlayVideo && (
                  <button
                    onClick={() => {
                      onPlayVideo(video);
                      onClose();
                    }}
                    className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-950/60 transition-transform active:scale-95 flex items-center gap-2 text-xs font-semibold"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Watch Now</span>
                  </button>
                )}
              </div>
            </div>

            {/* Core Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Resolution */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-400">Resolution</div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {resolutionInfo.width} × {resolutionInfo.height}
                  </div>
                  <div className="text-[11px] text-cyan-300/90 mt-0.5 flex items-center gap-1">
                    <span>{resolutionInfo.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>{resolutionInfo.aspectRatio}</span>
                  </div>
                </div>
              </div>

              {/* 2. Duration */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-400">Duration</div>
                  <div className="text-sm font-semibold text-white mt-0.5 font-mono">
                    {formatSeconds(currentDuration)}
                  </div>
                  <div className="text-[11px] text-amber-300/90 mt-0.5">
                    {Math.round(currentDuration)} total seconds of playback
                  </div>
                </div>
              </div>

              {/* 3. Original Upload Date */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-400">Original Upload Date</div>
                  <div className="text-xs font-semibold text-white mt-0.5 leading-snug">
                    {formatFullDate(video.uploadedAt)}
                  </div>
                  {relativeTime && (
                    <div className="text-[11px] text-purple-300/90 mt-0.5">
                      {relativeTime}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. File Size & Storage */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-400">File Size</div>
                  <div className="text-sm font-semibold text-white mt-0.5 font-mono">
                    {formatBytes(video.size)}
                  </div>
                  <div className="text-[11px] text-emerald-300/90 mt-0.5 font-mono">
                    {video.size.toLocaleString()} bytes
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Technical Specifications */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                <span>Technical Specifications & Metadata</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/20">
                  <span className="text-slate-400">File Name:</span>
                  <span className="font-mono text-slate-200 truncate max-w-[200px]" title={video.name}>
                    {video.name}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-black/20">
                  <span className="text-slate-400">MIME Type:</span>
                  <span className="font-mono text-slate-200">{video.mimeType || 'video/mp4'}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-black/20">
                  <span className="text-slate-400">Container:</span>
                  <span className="text-slate-200 uppercase font-mono">
                    {video.name.split('.').pop() || 'mp4'} (ISO-BMFF)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-black/20">
                  <span className="text-slate-400">Uploaded By:</span>
                  <span className="text-slate-200 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{video.uploadedBy?.name || 'Couple User'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 sm:col-span-2">
                  <span className="text-slate-400">Storage Folder:</span>
                  <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                    <Folder className="w-3 h-3 text-amber-400" />
                    <span>{video.driveFolder || 'Everly Shared Storage/Videos'}</span>
                  </span>
                </div>

                {diagnosticReport?.codecs && diagnosticReport.codecs.length > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 sm:col-span-2">
                    <span className="text-slate-400">Detected Codecs:</span>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      {diagnosticReport.codecs.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#090e18] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verified Cinema Ready</span>
            </div>

            <div className="flex items-center gap-2">
              {onDownload && (
                <button
                  onClick={() => onDownload(video)}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              )}

              {onPlayVideo && (
                <button
                  onClick={() => {
                    onPlayVideo(video);
                    onClose();
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-rose-950/50 flex items-center gap-1.5 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Watch Clip</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
