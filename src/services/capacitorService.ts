import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

export interface CapacitorMobileConfig {
  onBackButton?: () => boolean; // returns true if handled internally
  onNetworkChange?: (isOnline: boolean) => void;
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Initializes Capacitor plugins for Android mobile experience
 */
export async function initCapacitorMobile(config?: CapacitorMobileConfig): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback for network status listeners
    const handleOnline = () => config?.onNetworkChange?.(true);
    const handleOffline = () => config?.onNetworkChange?.(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  const cleanups: Array<() => void> = [];

  // 1. Status Bar styling for Android
  try {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setStyle({ style: Style.Dark });
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#080b12' });
        await StatusBar.setOverlaysWebView({ overlay: false });
      }
    }
  } catch (err) {
    console.warn('[Capacitor] StatusBar initialization notice:', err);
  }

  // 2. Keyboard behavior on Android
  try {
    if (Capacitor.isPluginAvailable('Keyboard')) {
      const showSub = await Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.classList.add('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      });
      const hideSub = await Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      });

      cleanups.push(() => {
        showSub.remove();
        hideSub.remove();
      });
    }
  } catch (err) {
    console.warn('[Capacitor] Keyboard initialization notice:', err);
  }

  // 3. Android Hardware Back Button listener
  try {
    if (Capacitor.isPluginAvailable('App')) {
      const backSub = await App.addListener('backButton', (state) => {
        const handledByApp = config?.onBackButton ? config.onBackButton() : false;
        if (!handledByApp) {
          if (state.canGoBack) {
            window.history.back();
          } else {
            App.minimizeApp();
          }
        }
      });

      cleanups.push(() => {
        backSub.remove();
      });
    }
  } catch (err) {
    console.warn('[Capacitor] App backButton initialization notice:', err);
  }

  // 4. Online / Offline network listeners
  const handleOnline = () => config?.onNetworkChange?.(true);
  const handleOffline = () => config?.onNetworkChange?.(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  cleanups.push(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
