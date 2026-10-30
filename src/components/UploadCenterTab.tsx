import React, { useState, useRef } from 'react';
import { AuthorizedUser } from '../types';
import { formatBytes, determineMediaType } from '../services/storageService';
import { BackupStatusWidget } from './BackupStatusWidget';
import {
  UploadCloud,
  CheckCircle2,
  File,
  Image,
  Video,
  Music,
  FileText,
  X,
  HardDrive,
  Heart,
} from 'lucide-react';

interface UploadCenterTabProps {
  currentUser: AuthorizedUser;
  onUploadComplete: (file: File, caption?: string, preferredProvider?: string) => Promise<void>;
  onNavigateTab: (tab: 'moments' | 'cinema' | 'music' | 'vault') => void;
  onOpenStorageServers?: () => void;
}

interface QueuedFile {
  id: string;
  file: File;
  caption: string;
  progress: number;
  speed?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  type: 'photo' | 'video' | 'audio' | 'document';
}

export const UploadCenterTab: React.FC<UploadCenterTabProps> = ({
  currentUser,
  onUploadComplete,
  onNavigateTab,
  onOpenStorageServers,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<'automatic' | 'everly_drive' | 'media_cm' | 'local_disk'>('automatic');
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newItems: QueuedFile[] = Array.from(fileList).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      caption: '',
      progress: 0,
      status: 'pending',
      type: determineMediaType(f.type, f.name),
    }));

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const updateCaption = (id: string, text: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption: text } : item))
    );
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const startUploads = async () => {
    const pendingItems = queue.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;
    setUploadErrorMsg(null);

    for (const item of pendingItems) {
      // Set to uploading with initial speed
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: 'uploading', progress: 18, speed: '3.4 MB/s' }
            : q
        )
      );

      await new Promise((r) => setTimeout(r, 180));
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, progress: 65, speed: '4.9 MB/s' }
            : q
        )
      );

      try {
        const providerParam = selectedProvider === 'automatic' ? undefined : selectedProvider;
        await onUploadComplete(item.file, item.caption, providerParam);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'completed', progress: 100, speed: undefined }
              : q
          )
        );
      } catch (err: any) {
        setUploadErrorMsg(err.message || 'Upload failed');
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'error', speed: undefined } : q))
        );
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <Image className="w-4 h-4 text-rose-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-amber-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-violet-400" />;
      default:
        return <FileText className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getTargetFolder = (type: string) => {
    switch (type) {
      case 'photo':
        return 'Everly Shared Storage/Photos';
      case 'video':
        return 'Everly Shared Storage/Videos';
      case 'audio':
        return 'Everly Shared Storage/Music';
      default:
        return 'Everly Shared Storage/Memories';
    }
  };

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-400 mb-3 border border-rose-500/20 shadow-inner">
          <UploadCloud className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Dropzone
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Upload couple media directly to Google Drive and persistent multi-provider storage
        </p>
      </div>

      {/* Storage Destination Selector (Requirement 5: Everly, Media.cm, or Automatic) */}
      <div className="p-4 rounded-2xl bg-[#0f1422] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-semibold text-white block">Storage Destination:</span>
          <span className="text-[11px] text-slate-400">Choose where to store uploaded media and video files</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedProvider('automatic')}
            className={`px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
              selectedProvider === 'automatic'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Automatic (Best Server)
          </button>
          <button
            type="button"
            onClick={() => setSelectedProvider('everly_drive')}
            className={`px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
              selectedProvider === 'everly_drive'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Everly Cloud Storage
          </button>
          <button
            type="button"
            onClick={() => setSelectedProvider('media_cm')}
            className={`px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
              selectedProvider === 'media_cm'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Media.cm Video Cloud
          </button>
          <button
            type="button"
            onClick={() => setSelectedProvider('local_disk')}
            className={`px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
              selectedProvider === 'local_disk'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Fast Local Volume
          </button>
          {onOpenStorageServers && (
            <button
              type="button"
              onClick={onOpenStorageServers}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-medium text-[11px] transition-colors ml-1 cursor-pointer"
            >
              Manage Servers
            </button>
          )}
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadErrorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Upload Error:</span>
            <span>{uploadErrorMsg}</span>
          </div>
          <button onClick={() => setUploadErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Drive Backup Status & Force Sync Widget */}
      <BackupStatusWidget variant="banner" />

      {/* Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'border-rose-400 bg-rose-500/15 scale-[1.01] shadow-2xl shadow-rose-950/40'
            : 'border-white/15 bg-[#0d111d] hover:border-rose-500/40 hover:bg-[#121626]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-[#141b2b] border border-white/10 text-rose-400 mx-auto flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-sm font-semibold text-white">
          Drag and drop files here, or <span className="text-rose-400 underline underline-offset-4">browse files</span>
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Supports JPG, PNG, MP4, WebM, MP3, WAV, PDF, Markdown & more
        </p>

        {/* Sync Destination Tag */}
        <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#080b12] border border-white/10 text-[11px] text-slate-300">
          <HardDrive className="w-3.5 h-3.5 text-rose-400" />
          <span>Active Target:</span>
          <span className="font-mono text-rose-300">
            {selectedProvider === 'automatic'
              ? 'Automatic Smart Selection'
              : selectedProvider === 'media_cm'
              ? 'Media.cm Video Cloud'
              : selectedProvider === 'everly_drive'
              ? 'Everly Cloud Storage (Dual Drive)'
              : 'Streamora Fast Disk'}
          </span>
        </div>
      </div>

      {/* Upload Queue Section */}
      {queue.length > 0 && (
        <div className="bg-[#0e131f] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Upload Queue ({queue.length} items)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {pendingCount} pending · {completedCount} uploaded
              </p>
            </div>

            {pendingCount > 0 && (
              <button
                onClick={startUploads}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-rose-950/50"
              >
                Upload {pendingCount} {pendingCount === 1 ? 'File' : 'Files'} to Drive
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#080b12] border border-white/5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-800/80 shrink-0">
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate max-w-xs sm:max-w-sm">
                        {item.file.name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{formatBytes(item.file.size)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-rose-300/80 truncate">
                          {getTargetFolder(item.type)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'completed' && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Synced</span>
                      </span>
                    )}

                    {item.status === 'uploading' && (
                      <span className="text-[11px] font-mono text-rose-400 flex items-center gap-1.5 animate-pulse">
                        <span>{item.progress}%</span>
                        {item.speed && (
                          <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {item.speed}
                          </span>
                        )}
                      </span>
                    )}

                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                        title="Remove from queue"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Caption / Romantic Note Input */}
                {item.status === 'pending' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="Add a romantic note or memory caption (optional)..."
                      value={item.caption}
                      onChange={(e) => updateCaption(item.id, e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#121824] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/40"
                    />
                  </div>
                )}

                {/* Progress bar */}
                {item.status === 'uploading' && (
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick jump to tab button when items are uploaded */}
          {completedCount > 0 && (
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Files saved to Google Drive /Everly Shared Storage</span>
              </span>
              <button
                onClick={() => onNavigateTab('moments')}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                View in Moments Gallery
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
