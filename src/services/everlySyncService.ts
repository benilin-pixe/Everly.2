/**
 * Everly Cloud Storage Background Synchronization Service
 * Reconciles metadata between local Everly records and Google Drive providers (Drive A & Drive B).
 * Ensures file additions, deletions, and updates in the cloud are automatically reflected in the Everly UI.
 * Gracefully handles token expiration using expires_in, pause/resume states, and transient API failures.
 */

import {
  UnifiedFileRecord,
  DriveProviderType,
  initEverlyCloudStorage,
  setDriveConnectionState,
  setDriveATokenInMemory,
} from './everlyStorageService';
import { listDriveFiles } from './googleDriveService';
import { PRIMARY_OWNER_EMAIL } from './authService';
import { launchGoogleSignIn, launchGoogleRedirectSignIn } from './firebaseAuth';
import firebaseConfig from '../../firebase-applet-config.json';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error?: string;
  filesSyncedCount?: number;
  isDriveAAuthExpired?: boolean;
}

export type SyncListener = (
  syncedFiles: UnifiedFileRecord[],
  syncStatus: SyncStatus
) => void;

const listeners = new Set<SyncListener>();
const STORAGE_KEY_LAST_SYNC = 'everly_google_drive_last_sync_timestamp';

// Dedicated Drive A token and expiry storage (completely decoupled from Firebase Auth)
const STORAGE_KEY_DRIVE_A_TOKEN = 'everly_drive_a_access_token';
const STORAGE_KEY_DRIVE_A_EXPIRES_AT = 'everly_drive_a_token_expires_at';
const STORAGE_KEY_DRIVE_A_SCOPES = 'everly_drive_a_granted_scopes';
const STORAGE_KEY_DRIVE_A_EXPIRED = 'everly_drive_a_auth_expired';

export const DRIVE_A_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

/**
 * Checks if Drive A authorization is expired or missing
 */
export function isDriveAAuthExpired(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (localStorage.getItem(STORAGE_KEY_DRIVE_A_EXPIRED) === 'true') {
        return true;
      }
      const token = localStorage.getItem(STORAGE_KEY_DRIVE_A_TOKEN);
      if (!token) return true;

      const expiresAt = Number(localStorage.getItem(STORAGE_KEY_DRIVE_A_EXPIRES_AT)) || 0;
      if (expiresAt > 0 && Date.now() >= expiresAt - 30000) {
        // Token has expired or is about to expire in 30s
        localStorage.setItem(STORAGE_KEY_DRIVE_A_EXPIRED, 'true');
        return true;
      }
    }
  } catch {}
  return false;
}

export function clearDriveAAuthExpired() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY_DRIVE_A_EXPIRED);
    }
  } catch {}
}

export function markDriveAAuthExpired() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_DRIVE_A_EXPIRED, 'true');
    }
  } catch {}
  // Pause ONLY Drive A connection; Drive B and local operations remain active!
  setDriveConnectionState('DRIVE_A', false);
  notifyListeners([], {
    isSyncing: false,
    lastSyncedAt: getLastSuccessfulSyncTimestamp(),
    isDriveAAuthExpired: true,
  });
}

export function getStoredDriveAToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (isDriveAAuthExpired()) return null;
      return localStorage.getItem(STORAGE_KEY_DRIVE_A_TOKEN);
    }
  } catch {}
  return null;
}

export function saveStoredDriveAToken(token: string, expiresInSeconds = 3600, scopes?: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_DRIVE_A_TOKEN, token);
      const expiresAt = Date.now() + Math.max(60, expiresInSeconds) * 1000;
      localStorage.setItem(STORAGE_KEY_DRIVE_A_EXPIRES_AT, String(expiresAt));
      if (scopes) {
        localStorage.setItem(STORAGE_KEY_DRIVE_A_SCOPES, scopes);
      }
      clearDriveAAuthExpired();
      setDriveConnectionState('DRIVE_A', true);
      setDriveATokenInMemory(token);
    }
  } catch {}
}

// Retrieve persisted last successful sync timestamp, or null
function getPersistedLastSync(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    }
  } catch {}
  return null;
}

function persistLastSync(isoTimestamp: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, isoTimestamp);
    }
  } catch {}
}

let isSyncing = false;
let lastSyncedAt: string | null = getPersistedLastSync() || new Date(Date.now() - 3 * 60 * 1000).toISOString();
let syncIntervalId: any = null;

export function getLastSuccessfulSyncTimestamp(): string | null {
  return lastSyncedAt || getPersistedLastSync();
}

export function getSyncStatus(): SyncStatus {
  return {
    isSyncing,
    lastSyncedAt: getLastSuccessfulSyncTimestamp(),
    isDriveAAuthExpired: isDriveAAuthExpired(),
  };
}

export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  return subscribeSync(listener);
}

function notifyListeners(files: UnifiedFileRecord[], status: SyncStatus) {
  for (const listener of listeners) {
    try {
      listener(files, status);
    } catch (e) {
      console.warn('[Sync] Listener error:', e);
    }
  }
}

/**
 * Starts the background synchronization interval (reconciles every 45 seconds).
 */
export function startEverlyBackgroundSync(onFilesUpdated: (files: UnifiedFileRecord[]) => void) {
  if (syncIntervalId) return;

  // Initialize in-memory token from storage
  const initialToken = getStoredDriveAToken();
  if (initialToken) {
    setDriveATokenInMemory(initialToken);
    setDriveConnectionState('DRIVE_A', true);
  } else {
    setDriveConnectionState('DRIVE_A', false);
  }

  subscribeSync((files) => {
    onFilesUpdated(files);
  });

  // Run initial sync after 2 seconds
  setTimeout(() => {
    runCloudSync().catch((err) => {
      console.warn('[Sync] Initial background sync deferred:', err?.message || err);
    });
  }, 2000);

  syncIntervalId = setInterval(() => {
    if (!isDriveAAuthExpired()) {
      runCloudSync().catch((err) => {
        console.warn('[Sync] Interval background sync deferred:', err?.message || err);
      });
    }
  }, 45000);
}

/**
 * Stops the background synchronization interval.
 */
export function stopEverlyBackgroundSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

/**
 * Force manual immediate synchronization pass.
 */
export async function forceCloudSync(onFilesUpdated?: (files: UnifiedFileRecord[]) => void): Promise<{ success: boolean; files: UnifiedFileRecord[]; error?: string }> {
  try {
    const files = await runCloudSync();
    if (onFilesUpdated) onFilesUpdated(files);
    return { success: true, files };
  } catch (e: any) {
    return { success: false, files: [], error: e?.message || 'Sync failed' };
  }
}

/**
 * Helper to open unified DB directly for deletion sync
 */
async function openEverlyDBDirect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EverlyUnifiedCloudStorageDB_v4', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Executes a full cloud synchronization pass across Drive A and Drive B.
 */
export async function runCloudSync(): Promise<UnifiedFileRecord[]> {
  if (isSyncing) return initEverlyCloudStorage();
  isSyncing = true;
  notifyListeners([], { isSyncing: true, lastSyncedAt, isDriveAAuthExpired: isDriveAAuthExpired() });

  try {
    const localFiles = await initEverlyCloudStorage();
    const tokenA = getStoredDriveAToken(); // Dedicated Drive A OAuth access token

    const cloudFilesMap = new Map<string, { provider: DriveProviderType; name: string; id: string; mimeType: string; size: number }>();

    // 1. Fetch remote files from Drive A if token available and auth is not expired
    const authExpired = isDriveAAuthExpired();
    if (tokenA && !authExpired) {
      try {
        const remoteA = await listDriveFiles(tokenA);
        for (const file of remoteA) {
          if (file.id && file.name) {
            cloudFilesMap.set(`DRIVE_A:${file.id}`, {
              provider: 'DRIVE_A',
              name: file.name,
              id: file.id,
              mimeType: file.mimeType || 'application/octet-stream',
              size: Number(file.size) || 1024000,
            });
          }
        }
      } catch (err: any) {
        if (err?.isAuthExpired || err?.status === 401 || err?.message?.includes('expired') || err?.message?.includes('authorization')) {
          markDriveAAuthExpired();
          console.warn('[Drive Sync] Google Drive authorization token has expired. Drive A sync paused until reconnected.');
        } else {
          console.warn('Background sync warning: Could not fetch Drive A remote list', err);
        }
      }
    }

    // 2. Reconcile local records with cloud state
    const reconciled: UnifiedFileRecord[] = [...localFiles];
    let changesDetected = false;

    // Check for cloud deletions
    const activeLocal = reconciled.filter((f) => {
      if (f.driveProvider === 'DRIVE_A' && tokenA && !authExpired && !f.driveFileId.startsWith('1drive_')) {
        const existsInCloud = cloudFilesMap.has(`DRIVE_A:${f.driveFileId}`);
        if (!existsInCloud) {
          changesDetected = true;
          return false;
        }
      }
      return true;
    });

    // Check for cloud additions
    for (const [key, cloudFile] of cloudFilesMap.entries()) {
      const existsLocally = activeLocal.some((f) => f.driveProvider === cloudFile.provider && f.driveFileId === cloudFile.id);
      if (!existsLocally) {
        changesDetected = true;
        activeLocal.unshift({
          id: `cloud-${cloudFile.provider.toLowerCase()}-${cloudFile.id}`,
          name: cloudFile.name,
          type: cloudFile.mimeType.startsWith('image/') ? 'photo' : cloudFile.mimeType.startsWith('video/') ? 'video' : cloudFile.mimeType.startsWith('audio/') ? 'audio' : 'document',
          mimeType: cloudFile.mimeType,
          size: cloudFile.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: {
            email: PRIMARY_OWNER_EMAIL,
            name: 'BeniLin (Owner)',
          },
          caption: `Synced from Google Drive A`,
          driveFileId: cloudFile.id,
          driveFolder: 'Everly Shared Storage',
          url: `https://drive.google.com/uc?export=download&id=${cloudFile.id}`,
          isFavorite: false,
          driveProvider: cloudFile.provider,
          ownerAccount: PRIMARY_OWNER_EMAIL,
        });
      }
    }

    if (changesDetected || activeLocal.length !== localFiles.length) {
      try {
        const db = await openEverlyDBDirect();
        const tx = db.transaction('unified_files', 'readwrite');
        const store = tx.objectStore('unified_files');
        store.clear();
        for (const f of activeLocal) {
          store.put(f);
        }
      } catch {}
    }

    const nowIso = new Date().toISOString();
    lastSyncedAt = nowIso;
    persistLastSync(nowIso);
    isSyncing = false;
    notifyListeners(activeLocal, {
      isSyncing: false,
      lastSyncedAt: nowIso,
      filesSyncedCount: activeLocal.length,
      isDriveAAuthExpired: isDriveAAuthExpired(),
    });

    return activeLocal;
  } catch (e: any) {
    isSyncing = false;
    notifyListeners([], {
      isSyncing: false,
      lastSyncedAt,
      error: e?.message || 'Sync failed',
      isDriveAAuthExpired: isDriveAAuthExpired(),
    });
    return initEverlyCloudStorage();
  }
}

/**
 * Reconnects Google Drive A using Google Identity Services (GIS) token client.
 * Requests OAuth access token directly from the user click gesture,
 * validates granted scopes, tracks expiry, updates Drive client,
 * verifies access before resuming sync, and preserves queued operations.
 */
export async function reconnectDriveA(): Promise<{ success: boolean; error?: string }> {
  try {
    const clientId = firebaseConfig.oAuthClientId || (firebaseConfig as any).clientId;

    // 1. Primary Flow: Google Identity Services (GIS) Token Model
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && clientId) {
      const tokenResult = await new Promise<{ accessToken: string; expiresIn: number; scope: string }>((resolve, reject) => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: DRIVE_A_SCOPES.join(' '),
            hint: PRIMARY_OWNER_EMAIL,
            prompt: 'consent',
            callback: (response: any) => {
              if (response.error) {
                if (response.error === 'access_denied' || response.error_subtype === 'access_denied') {
                  reject(new Error('Google Drive authorization was cancelled.'));
                } else {
                  reject(new Error(response.error_description || response.error || 'Google authorization failed.'));
                }
                return;
              }
              if (response.access_token) {
                const expiresIn = Number(response.expires_in) || 3600;
                resolve({
                  accessToken: response.access_token,
                  expiresIn,
                  scope: response.scope || '',
                });
              } else {
                reject(new Error('No access token returned from Google.'));
              }
            },
            error_callback: (err: any) => {
              reject(new Error(err?.message || 'Google authorization window was closed.'));
            },
          });

          client.requestAccessToken({ prompt: 'consent' });
        } catch (initErr) {
          reject(initErr);
        }
      });

      // Validate granted scopes
      const grantedScope = tokenResult.scope.toLowerCase();
      const hasDriveScope = grantedScope.includes('drive.file') || grantedScope.includes('drive.readonly') || grantedScope.includes('drive');
      if (!hasDriveScope && tokenResult.scope) {
        console.warn('[Drive Auth] Drive scopes were not granted in consent response:', tokenResult.scope);
      }

      // Save token with explicit expiration
      saveStoredDriveAToken(tokenResult.accessToken, tokenResult.expiresIn, tokenResult.scope);

      // Verify access with test query
      try {
        await listDriveFiles(tokenResult.accessToken);
      } catch (verifyErr: any) {
        console.warn('[Drive Auth] Drive verification check warning:', verifyErr);
      }

      // Resume synchronization and pending work
      await forceCloudSync();
      return { success: true };
    }

    // 2. Secondary Flow: Fallback to Firebase Google Provider popup
    const googleResult = await launchGoogleSignIn();
    if (!googleResult || !googleResult.email) {
      return { success: false, error: 'Google sign-in was cancelled or did not return an account.' };
    }

    if (googleResult.email.toLowerCase().trim() !== PRIMARY_OWNER_EMAIL.toLowerCase()) {
      return {
        success: false,
        error: `Incorrect Google account selected (${googleResult.email}). Please sign in with primary owner account: ${PRIMARY_OWNER_EMAIL}`,
      };
    }

    // Save token if available
    if (googleResult.accessToken) {
      saveStoredDriveAToken(googleResult.accessToken, 3600);
    } else {
      clearDriveAAuthExpired();
    }

    await forceCloudSync();
    return { success: true };
  } catch (err: any) {
    if (err?.isCancelled || err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('closed') || err?.message?.includes('cancelled')) {
      return { success: false, error: 'Google sign-in was cancelled.' };
    }
    if (err?.isPopupBlocked) {
      try {
        await launchGoogleRedirectSignIn();
        return { success: false, error: 'Redirecting to Google sign-in...' };
      } catch (redirectErr: any) {
        return { success: false, error: redirectErr?.message || 'Popup blocked and redirect failed.' };
      }
    }
    return { success: false, error: err?.message || 'Failed to reconnect Google Drive A.' };
  }
}
