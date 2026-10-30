import React from 'react';
import { WallpaperConfig } from '../services/themeService';

interface WallpaperBackgroundProps {
  wallpaper?: WallpaperConfig;
}

export const WallpaperBackground: React.FC<WallpaperBackgroundProps> = ({ wallpaper }) => {
  if (!wallpaper || !wallpaper.enabled || !wallpaper.imageUrl) {
    return null;
  }

  const {
    imageUrl,
    blur = 0,
    darkness = 60,
    opacity = 100,
    position = 'center',
    size = 'cover',
  } = wallpaper;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* The Wallpaper Image layer */}
      <div
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundPosition: position,
          backgroundSize: size,
          backgroundRepeat: 'no-repeat',
          filter: blur > 0 ? `blur(${blur}px)` : 'none',
          opacity: opacity / 100,
          transform: blur > 0 ? 'scale(1.05)' : 'none', // Prevent blurred edge artifacts
        }}
        className="absolute inset-0 transition-all duration-700 ease-out"
      />

      {/* Dynamic Darkness & Vignette Overlay so text and UI remain ultra crisp and readable */}
      <div
        style={{
          backgroundColor: `rgba(5, 8, 15, ${darkness / 100})`,
        }}
        className="absolute inset-0 backdrop-blur-[0.5px] transition-colors duration-500"
      />

      {/* Subtle radial vignette gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />
    </div>
  );
};
