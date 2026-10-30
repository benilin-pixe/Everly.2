/**
 * Everly Daily Quote & Inspiration Engine
 * Automatically delivers one curated, meaningful quote per calendar day across Love,
 * Memories, Motivation, Growth, Hope, Togetherness, Life, and New Beginnings.
 * Supports favorites persistence and deterministic daily rotation.
 */

export type QuoteCategory =
  | 'Love'
  | 'Memories'
  | 'Motivation'
  | 'Growth'
  | 'Hope'
  | 'Togetherness'
  | 'Life'
  | 'New Beginnings';

export interface DailyQuote {
  id: string;
  text: string;
  author?: string;
  category: QuoteCategory;
  categoryEmoji: string;
  dateKey: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "September 26, 2026"
}

export const CATEGORY_EMOJIS: Record<QuoteCategory, string> = {
  Love: '❤️',
  Memories: '🌙',
  Motivation: '✨',
  Growth: '🌱',
  Hope: '🌅',
  Togetherness: '🤝',
  Life: '💭',
  'New Beginnings': '🌱',
};

export const CURATED_QUOTES: Array<{
  text: string;
  category: QuoteCategory;
  author?: string;
}> = [
  {
    text: 'Every beautiful memory begins with a moment someone decided was worth keeping.',
    category: 'Memories',
    author: 'Everly Vault',
  },
  {
    text: 'Some moments become memories before we even realize how much they will mean to us.',
    category: 'Memories',
    author: 'Everly Keepsake',
  },
  {
    text: 'In the garden of time, love is the blossom that never fades and the light that guides us home.',
    category: 'Love',
    author: 'Ben & Shana',
  },
  {
    text: 'Togetherness is not about being inseparable, but about being separated and knowing nothing changes.',
    category: 'Togetherness',
  },
  {
    text: 'The best chapters of our story are the quiet ones written between ordinary conversations.',
    category: 'Love',
  },
  {
    text: 'Keep looking forward. The sunrise tomorrow will illuminate roads you haven’t yet walked.',
    category: 'Hope',
  },
  {
    text: 'Growth is silent, patient, and deeply rooted. Trust the timing of your journey.',
    category: 'Growth',
  },
  {
    text: 'You don’t have to see the whole staircase, just take the first step with an open heart.',
    category: 'Motivation',
  },
  {
    text: 'A shared laugh, a whispered melody, a held hand—these are the timeless anchors of life.',
    category: 'Life',
  },
  {
    text: 'Every sunrise is an invitation to begin anew, with deeper love and lighter burdens.',
    category: 'New Beginnings',
  },
  {
    text: 'Memories are our heart’s private museum, preserved in starlight and gentle devotion.',
    category: 'Memories',
  },
  {
    text: 'To love and be loved is to feel the sun from both sides.',
    category: 'Love',
  },
  {
    text: 'When we walk side by side, every long road turns into an adventure.',
    category: 'Togetherness',
  },
  {
    text: 'You are capable of far more than your doubts allow you to imagine. Keep blooming.',
    category: 'Motivation',
  },
  {
    text: 'Hope is the quiet whisper inside saying "try again tomorrow" when everything else is still.',
    category: 'Hope',
  },
  {
    text: 'What we water with patience and kindness will inevitably grow into something extraordinary.',
    category: 'Growth',
  },
  {
    text: 'Life isn’t measured by the breaths we take, but by the moments that take our breath away.',
    category: 'Life',
  },
  {
    text: 'Let today be the day you forgive what was, embrace what is, and welcome what will be.',
    category: 'New Beginnings',
  },
  {
    text: 'Two souls, one private universe—built on laughter, shared music, and unwavering trust.',
    category: 'Love',
  },
  {
    text: 'The sound of your laughter is the soundtrack to my happiest days.',
    category: 'Love',
  },
  {
    text: 'Hold on to the moments that make you smile in the middle of a crowded room.',
    category: 'Memories',
  },
  {
    text: 'Small daily steps in love and purpose create miles of enduring happiness.',
    category: 'Growth',
  },
  {
    text: 'Together we make the darkest nights feel like a canvas for infinite constellations.',
    category: 'Togetherness',
  },
  {
    text: 'Dare to begin again. The most breathtaking view comes after the hardest climb.',
    category: 'Motivation',
  },
  {
    text: 'Wherever you are is where my peace begins.',
    category: 'Love',
  },
  {
    text: 'Cherish the ordinary afternoons; one day they will be the golden memories you long for.',
    category: 'Memories',
  },
  {
    text: 'Hope is a gentle beacon that refuses to be extinguished by passing storms.',
    category: 'Hope',
  },
  {
    text: 'True growth is learning to love the person you were while building the person you are becoming.',
    category: 'Growth',
  },
  {
    text: 'May our shared universe always be filled with melody, warmth, and safe harbors.',
    category: 'Togetherness',
  },
  {
    text: 'Every new day is a fresh page in the grand book of us. Write it with gratitude.',
    category: 'New Beginnings',
  },
];

const CACHED_QUOTE_KEY = 'everly_daily_quote_cached_v1';
const FAVORITE_QUOTES_KEY = 'everly_favorite_quotes_list_v1';

/**
 * Get current date key in YYYY-MM-DD format based on local browser date
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format date for quote header e.g. "September 26, 2026"
 */
export function formatQuoteDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Deterministic hash algorithm for date string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Retrieve the active quote for today (persisted and unchanged for the entire calendar day)
 */
export function getDailyQuote(): DailyQuote {
  const todayKey = getLocalDateKey();
  const todayFormatted = formatQuoteDate();

  try {
    const cachedRaw = localStorage.getItem(CACHED_QUOTE_KEY);
    if (cachedRaw) {
      const parsed: DailyQuote = JSON.parse(cachedRaw);
      if (parsed.dateKey === todayKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached quote:', e);
  }

  // Pick deterministic quote for this day
  const hash = hashString(todayKey);
  const index = hash % CURATED_QUOTES.length;
  const picked = CURATED_QUOTES[index];

  const newQuote: DailyQuote = {
    id: `quote-${todayKey}`,
    text: picked.text,
    author: picked.author || 'Everly',
    category: picked.category,
    categoryEmoji: CATEGORY_EMOJIS[picked.category] || '✨',
    dateKey: todayKey,
    formattedDate: todayFormatted,
  };

  try {
    localStorage.setItem(CACHED_QUOTE_KEY, JSON.stringify(newQuote));
  } catch (e) {
    console.warn('Could not cache daily quote:', e);
  }

  return newQuote;
}

/**
 * Get all favorite saved quotes
 */
export function getFavoriteQuotes(): DailyQuote[] {
  try {
    const raw = localStorage.getItem(FAVORITE_QUOTES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not get favorite quotes:', e);
  }
  return [];
}

/**
 * Check if a quote is in favorites
 */
export function isQuoteFavorited(quoteId: string): boolean {
  const favs = getFavoriteQuotes();
  return favs.some((q) => q.id === quoteId || q.text === quoteId);
}

/**
 * Toggle favorite status of a quote
 */
export function toggleFavoriteQuote(quote: DailyQuote): boolean {
  const favs = getFavoriteQuotes();
  const index = favs.findIndex((q) => q.id === quote.id || q.text === quote.text);

  let isNowFav = false;
  if (index >= 0) {
    favs.splice(index, 1);
    isNowFav = false;
  } else {
    favs.unshift(quote);
    isNowFav = true;
  }

  try {
    localStorage.setItem(FAVORITE_QUOTES_KEY, JSON.stringify(favs));
  } catch (e) {
    console.warn('Could not save favorite quotes:', e);
  }

  return isNowFav;
}

/**
 * Remove a specific quote from favorites
 */
export function removeFavoriteQuote(quoteId: string): DailyQuote[] {
  const favs = getFavoriteQuotes().filter((q) => q.id !== quoteId && q.text !== quoteId);
  try {
    localStorage.setItem(FAVORITE_QUOTES_KEY, JSON.stringify(favs));
  } catch (e) {
    console.warn('Could not update favorites after deletion:', e);
  }
  return favs;
}
