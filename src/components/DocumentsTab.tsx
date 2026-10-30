import React, { useState } from 'react';
import { MediaFile, AuthorizedUser } from '../types';
import { formatBytes, triggerDownload } from '../services/storageService';
import { getDriveDocumentPreviewUrl } from '../services/driveStreamService';
import {
  FileText,
  Download,
  Trash2,
  Heart,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileCheck,
  X,
  Printer,
  Calendar,
  User,
  FolderLock,
  Palette,
  Sparkles,
} from 'lucide-react';

interface DocumentsTabProps {
  files: MediaFile[];
  currentUser: AuthorizedUser;
  onToggleFavorite: (id: string, current: boolean) => void;
  onRequestDelete: (file: MediaFile) => void;
  onOpenUpload: () => void;
  onOpenThemeModal?: () => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  files,
  currentUser,
  onToggleFavorite,
  onRequestDelete,
  onOpenUpload,
  onOpenThemeModal,
}) => {
  const docFiles = files.filter((f) => f.type === 'document');
  const [activeDoc, setActiveDoc] = useState<MediaFile | null>(null);

  const getDocIcon = (name: string) => {
    if (name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-400" />;
    }
    if (name.endsWith('.md') || name.endsWith('.txt')) {
      return <FileCode className="w-5 h-5 text-emerald-400" />;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-amber-400" />;
    }
    return <FileCheck className="w-5 h-5 text-sky-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-rose-500/15">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Vault</span>
            <span className="text-xs font-mono text-rose-300/80 font-normal">
              ({docFiles.length} files)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bucket lists, travel itineraries, and shared PDFs stored in <span className="font-mono text-rose-300">Everly Media/Vault</span>
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="self-start sm:self-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-950/40"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Vault Settings: Theme & Appearance Studio Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/30 via-[#0f1422]/90 to-indigo-950/30 border border-rose-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-indigo-500/20 border border-rose-500/30 text-rose-300">
            <Palette className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Vault Appearance & Theme Studio</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalize Everly with built-in themes, custom hex colors, or custom background wallpapers.
            </p>
          </div>
        </div>

        {onOpenThemeModal && (
          <button
            onClick={onOpenThemeModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md shadow-rose-950/40 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Open Theme Studio</span>
          </button>
        )}
      </div>

      {docFiles.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#0e131f] border border-white/5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No documents uploaded</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Store bucket lists, anniversary plans, reservations, and PDFs here.
          </p>
          <button
            onClick={onOpenUpload}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-colors"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docFiles.map((doc) => (
            <div
              key={doc.id}
              className="p-5 rounded-2xl bg-[#0e131f] border border-white/10 hover:border-rose-500/30 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 shrink-0">
                      {getDocIcon(doc.name)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                        {doc.name}
                      </h4>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{formatBytes(doc.size)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleFavorite(doc.id, Boolean(doc.isFavorite))}
                    className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Favorite"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        doc.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                      }`}
                    />
                  </button>
                </div>

                <p className="mt-3 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {doc.caption || 'Shared couple document archived in Google Drive.'}
                </p>
              </div>

              {/* Action footer */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                  By {doc.uploadedBy.name}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveDoc(doc)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => triggerDownload(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Download document"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRequestDelete(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Document / PDF Viewer Modal */}
      {activeDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-viewer-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setActiveDoc(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] bg-[#0e131f] border border-white/10 rounded-3xl shadow-2xl flex flex-col text-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="p-4 sm:px-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <div className="p-2 rounded-xl bg-slate-800 shrink-0">
                  {getDocIcon(activeDoc.name)}
                </div>
                <div className="min-w-0">
                  <h3 id="doc-viewer-title" className="text-sm font-semibold text-white truncate">
                    {activeDoc.name}
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{activeDoc.driveFolder}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatBytes(activeDoc.size)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => triggerDownload(activeDoc)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setActiveDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close document viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Content Viewport */}
            <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-[#080b12] text-slate-200 leading-relaxed font-sans text-sm selection:bg-rose-500/30">
              {activeDoc.contentData ? (
                <div className="prose prose-invert max-w-none space-y-4 whitespace-pre-wrap font-sans">
                  {activeDoc.contentData}
                </div>
              ) : activeDoc.url ? (
                <iframe
                  src={activeDoc.url}
                  title={activeDoc.name}
                  className="w-full h-[60vh] rounded-xl border border-white/10 bg-white"
                />
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <p>Document preview loaded from Google Drive.</p>
                  <button
                    onClick={() => triggerDownload(activeDoc)}
                    className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-medium"
                  >
                    Download to view full file
                  </button>
                </div>
              )}
            </div>

            {/* Bottom info footer */}
            <div className="p-4 sm:px-6 border-t border-white/10 bg-[#0a0e17] flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-rose-400" />
                <span>Uploaded by {activeDoc.uploadedBy.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(activeDoc.uploadedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
