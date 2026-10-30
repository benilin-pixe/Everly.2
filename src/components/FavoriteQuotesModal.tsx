import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  Heart,
  Trash2,
  Sparkles,
  Share2,
  Check,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  DailyQuote,
  getFavoriteQuotes,
  removeFavoriteQuote,
  QuoteCategory,
} from '../services/quoteService';

interface FavoriteQuotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuotesChanged?: () => void;
}

export const FavoriteQuotesModal: React.FC<FavoriteQuotesModalProps> = ({
  isOpen,
  onClose,
  onQuotesChanged,
}) => {
  const [favorites, setFavorites] = useState<DailyQuote[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    if (isOpen) {
      setFavorites(getFavoriteQuotes());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = (quoteId: string) => {
    const updated = removeFavoriteQuote(quoteId);
    setFavorites(updated);
    onQuotesChanged?.();
  };

  const handleCopy = (quote: DailyQuote) => {
    navigator.clipboard?.writeText(`"${quote.text}" — ${quote.author || 'Everly'}`);
    setCopiedId(quote.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = ['All', ...new Set(favorites.map((f) => f.category))];
  const filtered =
    selectedCategory === 'All'
      ? favorites
      : favorites.filter((f) => f.category === selectedCategory);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fav-quotes-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl my-6 bg-[#0c101b]/95 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-300">
              <Bookmark className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
                <span>Everly Keepsakes</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <h2 id="fav-quotes-title" className="text-xl sm:text-2xl font-bold text-white">
                Favorite Quotes ({favorites.length})
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        {categories.length > 2 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 pb-2 border-b border-white/5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Quotes List */}
        <div className="mt-5 space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {favorites.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-white/5 border border-white/5">
              <Heart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No favorite quotes saved yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Click "Save Quote" on any daily quote on the homepage to keep it in your permanent collection.
              </p>
            </div>
          ) : (
            filtered.map((q) => (
              <div
                key={q.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#111524]/90 border border-white/10 hover:border-rose-500/30 transition-all flex flex-col justify-between gap-3 group shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                    <span>{q.categoryEmoji}</span>
                    <span>{q.category}</span>
                  </span>

                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>{q.formattedDate}</span>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-white/95 italic font-serif leading-relaxed">
                  “{q.text}”
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                  <span className="text-slate-400 text-[11px] font-sans">
                    — {q.author || 'Everly'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(q)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Copy quote"
                    >
                      {copiedId === q.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRemove(q.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Remove from favorites"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
