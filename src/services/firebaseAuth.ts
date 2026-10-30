import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);
try {
  firebaseAuth.useDeviceLanguage();
} catch (e) {
  // Ignore in environments where window is not fully initialized
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export interface GoogleAuthResult {
  googleSub: string;
  email: string;
  name: string;
  avatarUrl?: string;
  idToken?: string;
  accessToken?: string;
  emailVerified: boolean;
}

export interface FormattedAuthError {
  message: string;
  code: string;
  isCancelled: boolean;
  isPopupBlocked: boolean;
  isDomainError: boolean;
  isOperationDisabled: boolean;
  actionHint?: string;
}

/**
 * Checks if running inside an iframe
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Maps Firebase Auth error codes to user-friendly and actionable messages
 */
export function formatFirebaseAuthError(error: any): FormattedAuthError {
  const code: string = error?.code || '';
  const rawMsg: string = error?.message || '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'current domain';

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    rawMsg.toLowerCase().includes('closed by user') ||
    error?.isCancelled
  ) {
    return {
      message: 'The Google account window was closed before finishing sign-in.',
      code: 'auth/popup-closed-by-user',
      isCancelled: true,
      isPopupBlocked: false,
      isDomainError: false,
      isOperationDisabled: false,
      actionHint: 'Click Continue with Google to reopen the account selector.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      message: `The sign-in window was blocked by your browser.`,
      code: 'auth/popup-blocked',
      isCancelled: false,
      isPopupBlocked: true,
      isDomainError: false,
      isOperationDisabled: false,
      actionHint: `Allow popups for ${hostname} or click "Continue with Redirect" below.`,
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      message: `Domain not authorized in Firebase Authentication: ${hostname}`,
      code: 'auth/unauthorized-domain',
      isCancelled: false,
      isPopupBlocked: false,
      isDomainError: true,
      isOperationDisabled: false,
      actionHint: `Add "${hostname}" to Authorized Domains in Firebase Console > Authentication > Settings > Authorized domains.`,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      message: 'Google Sign-in is not enabled in Firebase Authentication.',
      code: 'auth/operation-not-allowed',
      isCancelled: false,
      isPopupBlocked: false,
      isDomainError: false,
      isOperationDisabled: true,
      actionHint: 'Enable Google under Firebase Console > Authentication > Sign-in method.',
    };
  }

  if (code === 'auth/configuration-not-found' || code === 'auth/invalid-api-key') {
    return {
      message: 'Firebase project configuration error.',
      code,
      isCancelled: false,
      isPopupBlocked: false,
      isDomainError: false,
      isOperationDisabled: false,
      actionHint: 'Check the Firebase configuration in firebase-applet-config.json.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      message: 'Network connection failed during sign-in.',
      code: 'auth/network-request-failed',
      isCancelled: false,
      isPopupBlocked: false,
      isDomainError: false,
      isOperationDisabled: false,
      actionHint: 'Please check your internet connection and try again.',
    };
  }

  return {
    message: rawMsg || 'Google sign-in could not be completed. Please try again.',
    code: code || 'auth/unknown',
    isCancelled: false,
    isPopupBlocked: false,
    isDomainError: false,
    isOperationDisabled: false,
    actionHint: 'Please try again or check browser permissions.',
  };
}

/**
 * Initiates Google sign-in using Firebase Auth popup directly from the user click gesture.
 */
export async function launchGoogleSignIn(): Promise<GoogleAuthResult> {
  try {
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    const user = cred.user;
    const idToken = await user.getIdToken();
    const googleCred = GoogleAuthProvider.credentialFromResult(cred);
    const accessToken = googleCred?.accessToken;

    return {
      googleSub: user.uid,
      email: user.email || '',
      name: user.displayName || user.email?.split('@')[0] || 'Google User',
      avatarUrl: user.photoURL || undefined,
      idToken,
      accessToken,
      emailVerified: Boolean(user.emailVerified),
    };
  } catch (firebaseErr: any) {
    const formatted = formatFirebaseAuthError(firebaseErr);
    const err = new Error(formatted.message);
    (err as any).code = formatted.code;
    (err as any).isCancelled = formatted.isCancelled;
    (err as any).isPopupBlocked = formatted.isPopupBlocked;
    (err as any).actionHint = formatted.actionHint;
    (err as any).raw = firebaseErr;
    throw err;
  }
}

/**
 * Initiates Google sign-in using redirect flow (ideal for mobile or blocked popups).
 */
export async function launchGoogleRedirectSignIn(): Promise<void> {
  try {
    await signInWithRedirect(firebaseAuth, googleProvider);
  } catch (redirectErr: any) {
    const formatted = formatFirebaseAuthError(redirectErr);
    const err = new Error(formatted.message);
    (err as any).code = formatted.code;
    (err as any).actionHint = formatted.actionHint;
    throw err;
  }
}

/**
 * Checks for a pending redirect result upon page initialization.
 */
export async function checkRedirectSignInResult(): Promise<GoogleAuthResult | null> {
  try {
    const cred = await getRedirectResult(firebaseAuth);
    if (cred && cred.user) {
      const user = cred.user;
      const idToken = await user.getIdToken();
      return {
        googleSub: user.uid,
        email: user.email || '',
        name: user.displayName || user.email?.split('@')[0] || 'Google User',
        avatarUrl: user.photoURL || undefined,
        idToken,
        emailVerified: Boolean(user.emailVerified),
      };
    }
  } catch (err: any) {
    console.warn('[Firebase Auth] Error checking redirect result:', err);
    const formatted = formatFirebaseAuthError(err);
    const wrapped = new Error(formatted.message);
    (wrapped as any).code = formatted.code;
    (wrapped as any).actionHint = formatted.actionHint;
    throw wrapped;
  }
  return null;
}

/**
 * Subscribes to Firebase Auth state changes
 */
export function subscribeToFirebaseAuth(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}

/**
 * Signs out of the Firebase Auth session
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    await firebaseSignOut(firebaseAuth);
  } catch (err) {
    console.warn('[Google Auth] Error during Firebase sign out:', err);
  }
}
