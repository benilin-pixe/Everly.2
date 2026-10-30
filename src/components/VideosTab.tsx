import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { MediaFile, AuthorizedUser } from '../types';
import { formatBytes, triggerDownload } from '../services/storageService';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  Trash2,
  Heart,
  RotateCcw,
  AlertTriangle,
  HardDrive,
  PictureInPicture2,
  Info,
} from 'lucide-react';
import { resolveRawMediaSource, safelyPlayMedia, VideoDiagnosticReport } from '../services/driveStreamService';
import { VideoDetailsModal } from './VideoDetailsModal';

interface VideosTabProps {
  files: MediaFile[];
  currentUser: AuthorizedUser;
  onToggleFavorite: (id: string, current: boolean) => void;
  onRequestDelete: (file: MediaFile) => void;
  onOpenUpload: () => void;
  accessToken?: string | null;
  onVideoPlaybackChange?: (isPlaying: boolean) => void;
  onOpenStorageServers?: () => void;
}

export const VideosTab: React.FC<VideosTabProps> = ({
  files,
  currentUser,
  onToggleFavorite,
  onRequestDelete,
  onOpenUpload,
  accessToken,
  onVideoPlaybackChange,
  onOpenStorageServers,
}) => {
  const videoFiles = files.filter((f) => f.type === 'video');
  const [activeVideo, setActiveVideo] = useState<MediaFile | null>(
    videoFiles.length > 0 ? videoFiles[0] : null
  );

  // Sync activeVideo when files array loads or updates
  useEffect(() => {
    if (!activeVideo && videoFiles.length > 0) {
      setActiveVideo(videoFiles[0]);
    } else if (activeVideo) {
      const match = videoFiles.find((v) => v.id === activeVideo.id || v.name === activeVideo.name);
      if (match && (match !== activeVideo || (match.blobFile && !activeVideo.blobFile))) {
        setActiveVideo(match);
      }
    }
  }, [videoFiles, activeVideo]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);

  // Resolved stream source and error tracking
  const [resolvedSource, setResolvedSource] = useState<{
    streamUrl: string;
    mimeType: string;
  } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<VideoDiagnosticReport | null>(null);
  const [selectedDetailsVideo, setSelectedDetailsVideo] = useState<MediaFile | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Resolve stream whenever activeVideo changes (with race prevention and zero premature revocation)
  useEffect(() => {
    const currentRequestId = ++activeRequestIdRef.current;

    if (!activeVideo) {
      setResolvedSource(null);
      setVideoError(null);
      setDiagnosticReport(null);
      return;
    }

    setVideoError(null);
    setDiagnosticReport(null);
    setIsPlaying(false);
    setCurrentTime(0);

    resolveRawMediaSource(activeVideo, accessToken).then((res) => {
      // Ignore stale async results if activeVideo has already changed
      if (activeRequestIdRef.current !== currentRequestId) return;

      setResolvedSource(res);
      if (res.diagnostic) {
        setDiagnosticReport(res.diagnostic);
      }
    }).catch((err) => {
      if (activeRequestIdRef.current !== currentRequestId) return;
      setVideoError(err?.message || 'Failed to resolve video source');
    });
  }, [activeVideo, accessToken]);

  // Load new source into video element safely
  useEffect(() => {
    if (!videoRef.current || !resolvedSource?.streamUrl) return;

    videoRef.current.load();
    setCurrentTime(0);
    setVideoError(null);
  }, [resolvedSource?.streamUrl]);

  // Picture in picture event listeners
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleEnterPip = () => setIsPip(true);
    const handleLeavePip = () => setIsPip(false);

    el.addEventListener('enterpictureinpicture', handleEnterPip);
    el.addEventListener('leavepictureinpicture', handleLeavePip);

    return () => {
      el.removeEventListener('enterpictureinpicture', handleEnterPip);
      el.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, []);

  // Notify parent of playback state
  const handlePlaybackState = (playing: boolean) => {
    setIsPlaying(playing);
    onVideoPlaybackChange?.(playing);
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      const res = await safelyPlayMedia(videoRef.current);
      if (res.success) {
        handlePlaybackState(true);
        setVideoError(null);
      } else if (res.error) {
        setVideoError(res.error);
        handlePlaybackState(false);
      }
    } else {
      videoRef.current.pause();
      handlePlaybackState(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || activeVideo?.duration || 8);
    setVideoError(null);
  };

  const handleCanPlay = () => {
    setVideoError(null);
  };

  const handlePlaying = () => {
    setVideoError(null);
  };

  const handleWaiting = () => {
    // Buffering
  };

  const handleStalled = () => {
    // Stalled
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoEl = e.currentTarget;
    const err = videoEl.error;
    const src = videoEl.currentSrc || videoEl.src || 'video source';
    const mime = resolvedSource?.mimeType || 'unknown';
    const netState = videoEl.networkState;
    const readyState = videoEl.readyState;

    console.error(
      '[VIDEO PLAYBACK ERROR]',
      {
        src,
        mimeType: mime,
        errorCode: err?.code,
        errorMessage: err?.message,
        networkState: netState,
        readyState: readyState,
      }
    );

    let message = 'The video could not be played. Format may not be supported or network error occurred.';
    if (err) {
      switch (err.code) {
        case 1:
          message = 'Media loading aborted by user.';
          break;
        case 2:
          message = 'Network error while downloading video stream.';
          break;
        case 3:
          message = 'Video decoding failed or format is unsupported.';
          break;
        case 4:
          message = 'Video source not supported or unavailable.';
          break;
      }
    }

    setDiagnosticReport((prev) => {
      const codeStr = err ? `Error Code ${err.code} (${err.code === 1 ? 'Aborted' : err.code === 2 ? 'Network' : err.code === 3 ? 'Decode' : 'Format/Source Unsupported'})` : 'Format error';
      if (!prev) {
        return {
          sourceOrigin: src.startsWith('blob:') ? 'remote-fetch-blob' : 'stream-url',
          originalSourceType: src.startsWith('blob:') ? 'blob' : 'url',
          url: src,
          fileName: activeVideo?.name || 'video.mp4',
          isValidVideoFormat: false,
          errorCode: err?.code,
          errorMessage: err?.message || codeStr,
          diagnosticDetails: `Media Error: ${codeStr} | readyState: ${readyState} | networkState: ${netState}`,
        };
      }
      return {
        ...prev,
        errorCode: err?.code,
        errorMessage: err?.message || codeStr,
        diagnosticDetails: `${prev.diagnosticDetails} | Runtime: ${codeStr} [readyState: ${readyState}, networkState: ${netState}]`,
      };
    });

    setVideoError(message);
    handlePlaybackState(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPip(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPip(true);
      }
    } catch (e) {
      console.warn('Picture-in-picture error:', e);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-rose-500/15">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Cinema</span>
            <span className="text-xs font-mono text-rose-300/80 font-normal">
              ({videoFiles.length} {videoFiles.length === 1 ? 'video' : 'videos'})
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Streaming directly from configured multi-provider storage (Everly Cloud Storage, Media.cm Video Cloud, Fast Local Disk)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenStorageServers && (
            <button
              onClick={onOpenStorageServers}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-rose-400" />
              <span>Storage Servers</span>
            </button>
          )}
          <button
            onClick={onOpenUpload}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Upload Clip</span>
          </button>
        </div>
      </div>

      {videoFiles.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#0e131f] border border-white/5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center mb-3">
            <Play className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">Your Cinema is empty.</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Upload your first video to get started.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer shadow-lg shadow-rose-950/50 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Upload Video</span>
            </button>
            {onOpenStorageServers && (
              <button
                onClick={onOpenStorageServers}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                <span>Storage Servers</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Main Embedded Player */}
          {activeVideo && (
            <div className="bg-[#0e131f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div
                id="video-player-container"
                className="relative bg-black aspect-video max-h-[540px] w-full flex items-center justify-center group overflow-hidden"
              >
                {/* Fallback Viewport Error Banner if source fails */}
                {videoError ? (
                  <div className="absolute inset-0 bg-[#0e131f]/95 p-6 flex flex-col items-center justify-center text-center z-20 overflow-y-auto">
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-2">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-semibold text-white">Playback Format Unsupported</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                      {videoError}
                    </p>
                    {diagnosticReport && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-black/70 border border-white/10 text-left text-[11px] font-mono text-slate-300 max-w-lg w-full space-y-1.5 shadow-xl">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10">
                          <span className="font-semibold text-rose-300">TRUTH MODE MEDIA DIAGNOSTICS</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold uppercase">
                            {diagnosticReport.containerType || 'Binary'}
                          </span>
                        </div>
                        <div><strong className="text-rose-400">File Name:</strong> {diagnosticReport.fileName || activeVideo.name}</div>
                        <div><strong className="text-rose-400">Source Origin:</strong> {diagnosticReport.sourceOrigin || diagnosticReport.originalSourceType}</div>
                        {diagnosticReport.byteLength !== undefined && (
                          <div><strong className="text-rose-400">Byte Length:</strong> {diagnosticReport.byteLength} bytes ({formatBytes(diagnosticReport.byteLength)})</div>
                        )}
                        {diagnosticReport.httpStatus && (
                          <div><strong className="text-rose-400">HTTP Status:</strong> {diagnosticReport.httpStatus}</div>
                        )}
                        {diagnosticReport.contentType && (
                          <div><strong className="text-rose-400">Content-Type:</strong> {diagnosticReport.contentType}</div>
                        )}
                        {diagnosticReport.hexSignature && (
                          <div><strong className="text-rose-400">Hex Signature (16B):</strong> [{diagnosticReport.hexSignature}]</div>
                        )}
                        {diagnosticReport.containerType && (
                          <div><strong className="text-rose-400">Container:</strong> {diagnosticReport.containerType.toUpperCase()}{diagnosticReport.majorBrand ? ` (Major brand: '${diagnosticReport.majorBrand}')` : ''}</div>
                        )}
                        {diagnosticReport.codecs && diagnosticReport.codecs.length > 0 && (
                          <div><strong className="text-rose-400">Detected Codecs:</strong> {diagnosticReport.codecs.join(', ')}</div>
                        )}
                        {diagnosticReport.browserCanPlay && (
                          <div><strong className="text-rose-400">Browser canPlayType:</strong> {diagnosticReport.browserCanPlay}</div>
                        )}
                        {diagnosticReport.errorCode !== undefined && (
                          <div><strong className="text-rose-400">HTMLMediaElement Error:</strong> Code {diagnosticReport.errorCode} {diagnosticReport.errorMessage ? `(${diagnosticReport.errorMessage})` : ''}</div>
                        )}
                        {diagnosticReport.failureStage && (
                          <div><strong className="text-rose-400">Failure Stage:</strong> <span className="text-amber-300 font-medium">{diagnosticReport.failureStage}</span></div>
                        )}
                        <div className="text-slate-400 pt-1 border-t border-white/10 text-[10px]">
                          <strong className="text-rose-400">Details:</strong> {diagnosticReport.diagnosticDetails}
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => {
                          setVideoError(null);
                          if (videoRef.current) {
                            videoRef.current.load();
                            togglePlay();
                          }
                        }}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Stream</span>
                      </button>
                      <button
                        onClick={() => triggerDownload(activeVideo)}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Video</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* HTML5 Video Element with safe error boundary & direct src binding */}
                <video
                  ref={videoRef}
                  src={resolvedSource?.streamUrl}
                  poster={activeVideo.thumbnailUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onCanPlay={handleCanPlay}
                  onPlaying={handlePlaying}
                  onWaiting={handleWaiting}
                  onStalled={handleStalled}
                  onError={handleVideoError}
                  onEnded={() => handlePlaybackState(false)}
                  onPlay={() => handlePlaybackState(true)}
                  onPause={() => handlePlaybackState(false)}
                  onClick={togglePlay}
                  className="w-full h-full object-contain cursor-pointer"
                  playsInline
                />

                {/* Big Center Play overlay button when paused */}
                {!isPlaying && !videoError && (
                  <button
                    onClick={togglePlay}
                    aria-label="Play video"
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-110 transition-transform"
                  >
                    <Play className="w-7 h-7 fill-white ml-1" />
                  </button>
                )}

                {/* Custom Video Controls Bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-col gap-2 transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  {/* Timeline Seek Bar */}
                  <input
                    type="range"
                    min={0}
                    max={duration || activeVideo.duration || 10}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-white/20 accent-rose-500 rounded-lg cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlay}
                        className="p-1.5 hover:text-rose-400 transition-colors"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            setCurrentTime(0);
                          }
                        }}
                        className="p-1 hover:text-rose-300 transition-colors"
                        title="Replay from start"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* Time display */}
                      <span className="font-mono text-[11px] text-slate-300">
                        {formatTime(currentTime)} / {formatTime(duration || activeVideo.duration || 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Volume Slider */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={toggleMute}
                          className="p-1 hover:text-rose-400 transition-colors"
                          aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1 bg-white/20 accent-rose-500 rounded-lg cursor-pointer hidden sm:block"
                        />
                      </div>

                      <button
                        onClick={togglePip}
                        className={`p-1.5 transition-colors ${
                          isPip ? 'text-rose-400' : 'hover:text-rose-400'
                        }`}
                        title="Picture in Picture"
                        aria-label="Picture in Picture"
                      >
                        <PictureInPicture2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={toggleFullscreen}
                        className="p-1.5 hover:text-rose-400 transition-colors"
                        aria-label="Toggle Fullscreen"
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video metadata header below player */}
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {activeVideo.caption || activeVideo.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>Uploaded by {activeVideo.uploadedBy.name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(activeVideo.uploadedAt).toLocaleDateString()}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatBytes(activeVideo.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      Direct Stream Ready
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDetailsVideo(activeVideo)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
                    title="View video metadata & specifications"
                  >
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>Details</span>
                  </button>
                  <button
                    onClick={() => onToggleFavorite(activeVideo.id, Boolean(activeVideo.isFavorite))}
                    className={`p-2.5 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium ${
                      activeVideo.isFavorite
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        activeVideo.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                      }`}
                    />
                    <span>Favorite</span>
                  </button>
                  <button
                    onClick={() => triggerDownload(activeVideo)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => onRequestDelete(activeVideo)}
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Video List Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">All Video Clips</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videoFiles.map((video, idx) => {
                const isCurrent = activeVideo?.id === video.id;
                return (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setActiveVideo(video)}
                    className={`cursor-pointer rounded-2xl overflow-hidden p-3 border transition-colors text-left flex gap-3 ${
                      isCurrent
                        ? 'bg-rose-500/10 border-rose-500/40 shadow-lg'
                        : 'bg-[#101624] border-white/10 hover:border-rose-500/30'
                    }`}
                  >
                    <div className="w-24 h-16 rounded-xl bg-slate-900 overflow-hidden relative shrink-0">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Play className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                      <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[10px] font-mono text-slate-300">
                        {formatTime(video.duration || 8)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate">
                            {video.caption || video.name}
                          </h4>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {video.uploadedBy.name}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailsVideo(video);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors shrink-0"
                          title="View video details"
                          aria-label={`View video details for ${video.name}`}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                        <span>{formatBytes(video.size)}</span>
                        {isCurrent && <span className="text-rose-400 font-sans font-medium">Now Playing</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Video Details Modal */}
      <VideoDetailsModal
        video={selectedDetailsVideo}
        isOpen={Boolean(selectedDetailsVideo)}
        onClose={() => setSelectedDetailsVideo(null)}
        onPlayVideo={(v) => {
          setActiveVideo(v);
        }}
        onDownload={triggerDownload}
        diagnosticReport={selectedDetailsVideo?.id === activeVideo?.id ? diagnosticReport : null}
      />
    </div>
  );
};
