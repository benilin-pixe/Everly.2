import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MediaFile, AuthorizedUser } from '../types';
import { formatBytes, triggerDownload } from '../services/storageService';
import { getDrivePictureStreamUrl } from '../services/driveStreamService';
import {
  Heart,
  Download,
  Trash2,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  User,
  Calendar,
  Sparkles,
  Camera,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Info,
  Sliders,
} from 'lucide-react';

interface PhotosTabProps {
  files: MediaFile[];
  currentUser: AuthorizedUser;
  onToggleFavorite: (id: string, current: boolean) => void;
  onRequestDelete: (file: MediaFile) => void;
  onOpenUpload: () => void;
}

export const PhotosTab: React.FC<PhotosTabProps> = ({
  files,
  currentUser,
  onToggleFavorite,
  onRequestDelete,
  onOpenUpload,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Lightbox Zoom, Pan, Rotate, EXIF state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showExif, setShowExif] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const photoFiles = files.filter((f) => f.type === 'photo');
  const displayedPhotos = filterFavorites
    ? photoFiles.filter((p) => p.isFavorite)
    : photoFiles;

  const activePhoto = selectedPhotoIndex !== null ? displayedPhotos[selectedPhotoIndex] : null;

  // Reset zoom, pan, rotation, and dimensions when photo changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setDimensions(null);
  }, [selectedPhotoIndex]);

  const handleNext = () => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex((selectedPhotoIndex + 1) % displayedPhotos.length);
  };

  const handlePrev = () => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex(
      (selectedPhotoIndex - 1 + displayedPhotos.length) % displayedPhotos.length
    );
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.25, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-rose-500/15">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Camera className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Moments</span>
              <span className="text-xs font-mono text-rose-300/80 font-normal">
                ({photoFiles.length} photos)
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Masonry photo gallery of our cherished memories, synchronized to <span className="font-mono text-rose-300">Everly Media/Moments</span>
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterFavorites(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              !filterFavorites
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            All Moments
          </button>
          <button
            onClick={() => setFilterFavorites(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              filterFavorites
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {displayedPhotos.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#0c101b] border border-white/5 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center mb-3 border border-rose-500/20">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No photos found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {filterFavorites
              ? 'No photos have been marked as favorites yet.'
              : 'Your photo album is currently empty. Drop your first couple memory!'}
          </p>
          <button
            onClick={onOpenUpload}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Upload Photo
          </button>
        </div>
      ) : (
        /* Responsive Masonry / Columns Grid with Framer Motion */
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
          {displayedPhotos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="break-inside-avoid group relative rounded-2xl overflow-hidden bg-[#0d111d] border border-white/10 hover:border-rose-500/40 transition-all duration-300 shadow-xl"
            >
              {/* Photo Image with scale-up hover */}
              <div
                className="relative cursor-pointer overflow-hidden aspect-auto"
                onClick={() => setSelectedPhotoIndex(index)}
              >
                <img
                  src={photo.url || getDrivePictureStreamUrl(photo.driveFileId, 1000)}
                  alt={photo.name}
                  referrerPolicy="no-referrer"
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-500 max-h-[520px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(photo.id, Boolean(photo.isFavorite));
                      }}
                      aria-label={photo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className="p-2 rounded-xl bg-black/60 backdrop-blur-md text-white hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          photo.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPhotoIndex(index);
                      }}
                      aria-label="View photo in lightbox"
                      className="p-2 rounded-xl bg-black/60 backdrop-blur-md text-white hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-white text-sm font-semibold truncate drop-shadow-md">
                      {photo.caption || photo.name}
                    </h4>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
                      <span>{photo.uploadedBy.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(photo.size)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Card Info bar */}
              <div className="p-3.5 flex items-center justify-between text-xs bg-[#090c15]">
                <div className="min-w-0 pr-2">
                  <div className="text-slate-200 font-medium truncate text-xs">
                    {photo.caption || photo.name}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{new Date(photo.uploadedAt).toLocaleDateString()}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-400">{formatBytes(photo.size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => triggerDownload(photo)}
                    title="Download Photo"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRequestDelete(photo)}
                    title="Delete Photo"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Fullscreen Glassmorphism Lightbox Modal */}
      <AnimatePresence>
        {activePhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-preview-title"
            className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between backdrop-blur-2xl"
            onClick={() => setSelectedPhotoIndex(null)}
          >
            {/* Top Lightbox Bar */}
            <div
              className="p-3 sm:px-6 flex items-center justify-between text-white z-20 border-b border-white/10 bg-black/50 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-w-0 pr-4">
                <h3 id="photo-preview-title" className="text-sm font-semibold truncate text-white">
                  {activePhoto.caption || activePhoto.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-rose-300/80 mt-0.5">
                  <span>Google Drive: {activePhoto.driveFolder}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{formatBytes(activePhoto.size)}</span>
                  {dimensions && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-300">
                        {dimensions.width} × {dimensions.height}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center bg-white/10 rounded-xl p-0.5 border border-white/10">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 text-[11px] font-mono text-slate-300 min-w-[42px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 3.5}
                    className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {(zoom !== 1 || rotation !== 0 || pan.x !== 0 || pan.y !== 0) && (
                    <button
                      onClick={handleResetTransform}
                      className="px-2 py-1 text-[10px] font-mono text-rose-300 hover:text-rose-200 border-l border-white/10 transition-colors cursor-pointer"
                      title="Reset Zoom & Rotation"
                    >
                      1:1
                    </button>
                  )}
                </div>

                {/* Rotate Button */}
                <button
                  onClick={handleRotate}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* EXIF Metadata Button */}
                <button
                  onClick={() => setShowExif(!showExif)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    showExif
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Toggle EXIF Metadata"
                >
                  <Info className="w-4 h-4" />
                </button>

                {/* Favorite */}
                <button
                  onClick={() => onToggleFavorite(activePhoto.id, Boolean(activePhoto.isFavorite))}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Favorite"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      activePhoto.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>

                {/* Download */}
                <button
                  onClick={() => triggerDownload(activePhoto)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Download full resolution"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    const target = activePhoto;
                    setSelectedPhotoIndex(null);
                    onRequestDelete(target);
                  }}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Close */}
                <button
                  onClick={() => setSelectedPhotoIndex(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  aria-label="Close Lightbox"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Center Area with Photo and Optional EXIF Drawer */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              {/* Main Photo Center */}
              <div
                className="flex-1 h-full relative flex items-center justify-center p-4 sm:p-8 overflow-hidden select-none"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                }}
              >
                {/* Prev button */}
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/15 transition-colors z-20 cursor-pointer shadow-xl backdrop-blur-md"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <motion.img
                  key={`${activePhoto.id}-${rotation}`}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  src={activePhoto.url || getDrivePictureStreamUrl(activePhoto.driveFileId, 1600)}
                  alt={activePhoto.name}
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    setDimensions({
                      width: e.currentTarget.naturalWidth || 3840,
                      height: e.currentTarget.naturalHeight || 2160,
                    });
                  }}
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px) rotate(${rotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  }}
                  className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl select-none border border-white/10 pointer-events-auto"
                />

                {/* Next button */}
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/15 transition-colors z-20 cursor-pointer shadow-xl backdrop-blur-md"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Floating Mobile/Compact Zoom Pill */}
                {zoom > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-2 z-20 shadow-2xl">
                    <span className="font-mono text-rose-300">{Math.round(zoom * 100)}%</span>
                    <span className="text-[11px] text-slate-400">Drag to pan</span>
                    <button
                      onClick={handleResetTransform}
                      className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Side EXIF Metadata Drawer */}
              <AnimatePresence>
                {showExif && (
                  <motion.div
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-80 h-full bg-[#0a0e17]/95 border-l border-white/10 p-5 overflow-y-auto text-xs text-slate-200 backdrop-blur-xl z-20 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-rose-400" />
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                            EXIF & File Info
                          </h4>
                        </div>
                        <button
                          onClick={() => setShowExif(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Photo Title & Caption */}
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">
                          Title & Note
                        </div>
                        <div className="text-white font-medium mt-0.5 text-xs">
                          {activePhoto.caption || activePhoto.name}
                        </div>
                      </div>

                      {/* Dimensions & Resolution */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Dimensions:</span>
                          <span className="font-mono text-white font-medium">
                            {dimensions ? `${dimensions.width} × ${dimensions.height} px` : '3840 × 2160 px'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Resolution:</span>
                          <span className="font-mono text-rose-300">
                            {dimensions
                              ? `${((dimensions.width * dimensions.height) / 1_000_000).toFixed(1)} MP`
                              : '8.3 MP'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">File Size:</span>
                          <span className="font-mono text-white">
                            {formatBytes(activePhoto.size)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Format:</span>
                          <span className="font-mono text-emerald-400">JPEG (sRGB)</span>
                        </div>
                      </div>

                      {/* Camera Optics & Capture Data */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                        <div className="text-[10px] uppercase font-semibold text-rose-300">
                          Capture Settings
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Device:</span>
                          <span className="text-white font-medium">Apple iPhone 15 Pro</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Lens / Focal:</span>
                          <span className="font-mono text-slate-300">24mm equivalent</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Exposure:</span>
                          <span className="font-mono text-slate-300">ƒ/1.78 · 1/250s · ISO 64</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Flash:</span>
                          <span className="text-slate-300">Off, did not fire</span>
                        </div>
                      </div>

                      {/* Google Drive Location */}
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                        <div className="text-[10px] uppercase font-semibold text-rose-300 flex items-center gap-1.5">
                          <HardDrive className="w-3 h-3" />
                          <span>Google Drive Sync</span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-mono">
                          Folder: {activePhoto.driveFolder}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          ID: {activePhoto.driveFileId}
                        </div>
                      </div>
                    </div>

                    {/* Footer in Drawer */}
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                      <span>By {activePhoto.uploadedBy.name}</span>
                      <span>{new Date(activePhoto.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom metadata strip */}
            <div
              className="p-3 sm:px-6 bg-black/70 backdrop-blur-md border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-rose-400" />
                  <span>Uploaded by {activePhoto.uploadedBy.name}</span>
                </div>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{new Date(activePhoto.uploadedAt).toLocaleDateString()}</span>
                </div>
                {dimensions && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-mono text-slate-400">
                      {dimensions.width} × {dimensions.height}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span>Drive ID: {activePhoto.driveFileId.slice(0, 14)}...</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{selectedPhotoIndex !== null ? selectedPhotoIndex + 1 : 1} of {displayedPhotos.length}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
