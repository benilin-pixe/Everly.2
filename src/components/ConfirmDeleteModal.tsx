import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { MediaFile } from '../types';
import { formatBytes } from '../services/storageService';

interface ConfirmDeleteModalProps {
  file: MediaFile | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: MediaFile) => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  file,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  if (!isOpen || !file) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-md bg-[#131926] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="delete-dialog-title" className="text-lg font-semibold text-white tracking-tight">
              Delete File Confirmation
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Are you sure you want to permanently remove this file from your private couple drive? This operation cannot be undone.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File summary box */}
        <div className="mt-5 p-3.5 bg-[#0b0f17] border border-white/5 rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">File Name:</span>
            <span className="font-medium text-white truncate max-w-[220px]">{file.name}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">File Size:</span>
            <span className="font-mono text-slate-300">{formatBytes(file.size)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">Drive Path:</span>
            <span className="font-mono text-rose-300/80 truncate max-w-[220px]">{file.driveFolder}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">Uploaded By:</span>
            <span className="text-slate-300">{file.uploadedBy.name}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-850 rounded-xl transition-colors border border-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(file)}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-rose-950/50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
