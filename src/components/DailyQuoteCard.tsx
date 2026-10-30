import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Heart,
  Quote as QuoteIcon,
  Bookmark,
  Calendar,
  Clock,
  ChevronRight,
  Share2,
  Check,
} from 'lucide-react';
import {
  DailyQuote,
  getDailyQuote,
  isQuoteFavorited,
  toggleFavoriteQuote,
  getFavoriteQuotes,
} from '../services/quoteService';

interface DailyQuoteCardProps {
  onOpenFavoritesModal?: () => void;
  className?: string;
}

export const DailyQuoteCard: React.FC<DailyQuoteCardProps> = ({
  onOpenFavoritesModal,
  className = '',
}) => {
  const [quote, setQuote] = useState<DailyQuote>(getDailyQuote);
  const [isSaved, setIsSaved] = useState<boolean>(() => isQuoteFavorited(quote.id));
  const [favoriteCount, setFavoriteCount] = useState<number>(() => getFavoriteQuotes().length);
  const [copied, setCopied] = useState(false);

  // Sync quote on mount and periodically if date flips at midnight
  useEffect(() => {
    const active = getDailyQuote();
    setQuote(active);
    setIsSaved(isQuoteFavorited(active.id));
    setFavoriteCount(getFavoriteQuotes().length);

    // Check periodically for midnight transition
    const interval = setInterval(() => {
      const refreshed = getDailyQuote();
      if (refreshed.id !== quote.id) {
        setQuote(refreshed);
        setIsSaved(isQuoteFavorited(refreshed.id));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleSave = () => {
    const newState = toggleFavoriteQuote(quote);
    setIsSaved(newState);
    setFavoriteCount(getFavoriteQuotes().length);
  };

  const handleCopyQuote = () => {
    navigator.clipboard?.writeText(`"${quote.text}" — ${quote.author || 'Everly'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative rounded-3xl overflow-hidden border border-rose-500/20 bg-gradient-to-br from-[#121626]/90 via-[#161a2e]/85 to-[#131122]/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl transition-all duration-300 hover:border-rose-500/30 ${className}`}
    >
      {/* Decorative ambient flare */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between gap-5">
        {/* Header bar: Daily Quote title, Date & Category */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300">
              <QuoteIcon className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-rose-400">
                <span>DAILY QUOTE</span>
                <Sparkles className="w-3 h-3 text-amber-300" />
              </div>
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{quote.formattedDate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Category badge */}
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-200 border border-rose-500/20 shadow-inner flex items-center gap-1.5">
              <span>{quote.categoryEmoji}</span>
              <span>{quote.category}</span>
            </span>

            {/* View all favorites trigger */}
            {onOpenFavoritesModal && favoriteCount > 0 && (
              <button
                onClick={onOpenFavoritesModal}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                title="View Favorite Quotes"
              >
                <Bookmark className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Favorites</span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-400/20 px-1.5 py-0.2 rounded-full">
                  {favoriteCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Quote Content */}
        <div className="py-2 px-1">
          <p className="text-base sm:text-lg lg:text-xl font-medium text-white/95 leading-relaxed tracking-wide italic font-serif selection:bg-rose-500/30">
            “{quote.text}”
          </p>
          {quote.author && (
            <p className="text-xs font-sans text-rose-300/80 mt-2 font-medium tracking-wide">
              — {quote.author}
            </p>
          )}
        </div>

        {/* Footer actions: Save quote, Copy, and New quote tomorrow indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSave}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                isSaved
                  ? 'bg-rose-600 text-white border border-rose-500 shadow-rose-950/40'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isSaved ? 'fill-white scale-110' : 'text-rose-400'
                }`}
              />
              <span>{isSaved ? 'Saved to Favorites' : 'Save Quote'}</span>
            </button>

            <button
              onClick={handleCopyQuote}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy quote to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>

          {/* New quote tomorrow indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="tracking-wide">New quote tomorrow</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
