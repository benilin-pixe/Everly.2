/**
 * Everly Theme & Appearance Engine
 * Manages built-in themes, custom color palettes, background image wallpapers,
 * and live persistence across sessions.
 */

export interface ThemeColors {
  pageBg: string;
  cardBg: string;
  primaryAccent: string;
  secondaryAccent: string;
  textColor: string;
  mutedTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  borderColor: string;
  glowColor: string;
}

export interface WallpaperConfig {
  enabled: boolean;
  imageUrl: string;
  blur: number; // 0 - 30 (pixels)
  darkness: number; // 0 - 95 (percentage of dark overlay)
  opacity: number; // 10 - 100 (percentage opacity)
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  size: 'cover' | 'contain' | 'auto';
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  badge?: string;
  isBuiltin?: boolean;
  colors: ThemeColors;
  wallpaper?: WallpaperConfig;
  updatedAt?: string;
}

export const DEFAULT_WALLPAPER: WallpaperConfig = {
  enabled: false,
  imageUrl: '',
  blur: 0,
  darkness: 60,
  opacity: 100,
  position: 'center',
  size: 'cover',
};

export const BUILTIN_THEMES: ThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep obsidian starry skies with signature rose & amber starlight accents.',
    badge: 'Default',
    isBuiltin: true,
    colors: {
      pageBg: '#070a10',
      cardBg: '#0f1422',
      primaryAccent: '#f43f5e',
      secondaryAccent: '#fbbf24',
      textColor: '#f8fafc',
      mutedTextColor: '#94a3b8',
      buttonColor: '#e11d48',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(244, 63, 94, 0.25)',
      glowColor: 'rgba(244, 63, 94, 0.35)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Romantic velvet burgundy and delicate crimson blush glowing with love.',
    badge: 'Romantic',
    isBuiltin: true,
    colors: {
      pageBg: '#0d0408',
      cardBg: '#1b0813',
      primaryAccent: '#fb7185',
      secondaryAccent: '#fda4af',
      textColor: '#fff1f2',
      mutedTextColor: '#f43f5e',
      buttonColor: '#e11d48',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(251, 113, 133, 0.35)',
      glowColor: 'rgba(225, 29, 72, 0.45)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep aquatic midnight blues and luminous bioluminescent cyan ripples.',
    badge: 'Aquatic',
    isBuiltin: true,
    colors: {
      pageBg: '#030c17',
      cardBg: '#07182e',
      primaryAccent: '#06b6d4',
      secondaryAccent: '#38bdf8',
      textColor: '#f0f9ff',
      mutedTextColor: '#7dd3fc',
      buttonColor: '#0284c7',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(6, 182, 212, 0.35)',
      glowColor: 'rgba(6, 182, 212, 0.45)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Mystic polar emerald waves intertwined with glowing ultraviolet currents.',
    badge: 'Polar Light',
    isBuiltin: true,
    colors: {
      pageBg: '#02120e',
      cardBg: '#05241c',
      primaryAccent: '#10b981',
      secondaryAccent: '#c084fc',
      textColor: '#ecfdf5',
      mutedTextColor: '#6ee7b7',
      buttonColor: '#059669',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      glowColor: 'rgba(16, 185, 129, 0.45)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Serene pine canopy, misty emerald moss, and warm earthen undertones.',
    badge: 'Earthy',
    isBuiltin: true,
    colors: {
      pageBg: '#081008',
      cardBg: '#101f11',
      primaryAccent: '#22c55e',
      secondaryAccent: '#eab308',
      textColor: '#f0fdf4',
      mutedTextColor: '#86efac',
      buttonColor: '#16a34a',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(34, 197, 94, 0.3)',
      glowColor: 'rgba(34, 197, 94, 0.4)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm golden hour peach, fiery twilight coral, and glowing amber horizon.',
    badge: 'Golden Hour',
    isBuiltin: true,
    colors: {
      pageBg: '#120707',
      cardBg: '#230f0f',
      primaryAccent: '#f97316',
      secondaryAccent: '#fbbf24',
      textColor: '#fff7ed',
      mutedTextColor: '#fdba74',
      buttonColor: '#ea580c',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(249, 115, 22, 0.35)',
      glowColor: 'rgba(249, 115, 22, 0.45)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'purple-galaxy',
    name: 'Purple Galaxy',
    description: 'Cosmic nebula ultraviolet, stardust magenta, and deep astral void.',
    badge: 'Cosmic',
    isBuiltin: true,
    colors: {
      pageBg: '#090314',
      cardBg: '#17092c',
      primaryAccent: '#c084fc',
      secondaryAccent: '#f472b6',
      textColor: '#faf5ff',
      mutedTextColor: '#d8b4fe',
      buttonColor: '#9333ea',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(192, 132, 252, 0.35)',
      glowColor: 'rgba(147, 51, 234, 0.45)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    description: 'Pure carbon monochrome with crisp silver highlights and stealth aesthetic.',
    badge: 'Minimalist',
    isBuiltin: true,
    colors: {
      pageBg: '#09090b',
      cardBg: '#18181b',
      primaryAccent: '#e4e4e7',
      secondaryAccent: '#a1a1aa',
      textColor: '#ffffff',
      mutedTextColor: '#a1a1aa',
      buttonColor: '#27272a',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      glowColor: 'rgba(255, 255, 255, 0.2)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
  {
    id: 'everly',
    name: 'Everly',
    description: 'Signature obsidian stardust with warm champagne gold and velvet rose luminescence.',
    badge: 'Signature',
    isBuiltin: true,
    colors: {
      pageBg: '#080912',
      cardBg: '#121627',
      primaryAccent: '#f43f5e',
      secondaryAccent: '#f59e0b',
      textColor: '#ffffff',
      mutedTextColor: '#94a3b8',
      buttonColor: '#e11d48',
      buttonTextColor: '#ffffff',
      borderColor: 'rgba(244, 63, 94, 0.3)',
      glowColor: 'rgba(245, 158, 11, 0.35)',
    },
    wallpaper: { ...DEFAULT_WALLPAPER },
  },
];

const STORAGE_ACTIVE_THEME_KEY = 'everly_active_theme_config_v3';
const STORAGE_CUSTOM_THEMES_KEY = 'everly_custom_themes_list_v3';

type ThemeChangeListener = (theme: ThemePreset) => void;
const listeners = new Set<ThemeChangeListener>();

/**
 * Apply CSS variables to root document
 */
export function applyThemeVariables(theme: ThemePreset) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { colors } = theme;

  root.style.setProperty('--theme-page-bg', colors.pageBg);
  root.style.setProperty('--theme-card-bg', colors.cardBg);
  root.style.setProperty('--theme-primary', colors.primaryAccent);
  root.style.setProperty('--theme-secondary', colors.secondaryAccent);
  root.style.setProperty('--theme-text', colors.textColor);
  root.style.setProperty('--theme-text-muted', colors.mutedTextColor);
  root.style.setProperty('--theme-button', colors.buttonColor);
  root.style.setProperty('--theme-button-text', colors.buttonTextColor);
  root.style.setProperty('--theme-border', colors.borderColor);
  root.style.setProperty('--theme-glow', colors.glowColor);
}

/**
 * Get all stored custom themes
 */
export function getCustomThemes(): ThemePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_THEMES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read custom themes:', e);
  }
  return [];
}

/**
 * Get current active theme
 */
export function getActiveTheme(): ThemePreset {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.colors && typeof parsed.colors.pageBg === 'string') {
        return {
          ...BUILTIN_THEMES[0],
          ...parsed,
          colors: {
            ...BUILTIN_THEMES[0].colors,
            ...parsed.colors,
          },
          wallpaper: {
            ...DEFAULT_WALLPAPER,
            ...(parsed.wallpaper || {}),
          },
        };
      }
    }
  } catch (e) {
    console.warn('Could not read active theme:', e);
  }
  return BUILTIN_THEMES[0];
}

/**
 * Set and save active theme
 */
export function setActiveTheme(theme: ThemePreset): ThemePreset {
  try {
    localStorage.setItem(STORAGE_ACTIVE_THEME_KEY, JSON.stringify(theme));
  } catch (e) {
    console.warn('Could not save active theme:', e);
  }

  applyThemeVariables(theme);
  listeners.forEach((fn) => {
    try {
      fn(theme);
    } catch (err) {
      console.warn('Error in theme listener:', err);
    }
  });

  return theme;
}

/**
 * Save or update a custom theme
 */
export function saveCustomTheme(theme: ThemePreset): ThemePreset {
  const customs = getCustomThemes();
  const index = customs.findIndex((c) => c.id === theme.id);

  const updatedTheme: ThemePreset = {
    ...theme,
    isBuiltin: false,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    customs[index] = updatedTheme;
  } else {
    customs.push(updatedTheme);
  }

  try {
    localStorage.setItem(STORAGE_CUSTOM_THEMES_KEY, JSON.stringify(customs));
  } catch (e) {
    console.warn('Could not save custom theme list:', e);
  }

  // Also activate it
  setActiveTheme(updatedTheme);
  return updatedTheme;
}

/**
 * Delete a custom theme
 */
export function deleteCustomTheme(id: string): boolean {
  const customs = getCustomThemes().filter((c) => c.id !== id);
  try {
    localStorage.setItem(STORAGE_CUSTOM_THEMES_KEY, JSON.stringify(customs));
  } catch (e) {
    console.warn('Could not update custom themes after delete:', e);
  }

  const active = getActiveTheme();
  if (active.id === id) {
    setActiveTheme(BUILTIN_THEMES[0]);
  }
  return true;
}

/**
 * Reset theme to Midnight default
 */
export function resetThemeToDefault(): ThemePreset {
  return setActiveTheme(BUILTIN_THEMES[0]);
}

/**
 * Subscribe to theme updates
 */
export function subscribeTheme(listener: ThemeChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Compress / format image file to manageable base64 dataURL for localStorage
 */
export function processWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize if too large
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to WebP or JPEG
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          resolve(dataUrl);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
