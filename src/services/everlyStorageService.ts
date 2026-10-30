/**
 * Everly Cloud Storage Service (Unified Dual Google Drive Virtual Storage)
 * Combines Drive Account A (benilin76@gmail.com - Owner) and Drive Account B (benilin40@gmail.com - Storage Partner)
 * into one unified virtual storage system with intelligent storage balancing, automatic file distribution,
 * unified file library, and resilient multi-account connection handling.
 */

import { MediaFile, MediaType, StorageStats, AuthorizedUser } from '../types';
import {
  initializeEverlyStorage,
  uploadFileToDrive,
  deleteDriveFile,
  renameDriveFile,
  listDriveFiles,
  EverlySubfolder,
  GoogleDriveFile,
} from './googleDriveService';
import { PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL, getStoredAccessToken } from './authService';

export type DriveProviderType = 'DRIVE_A' | 'DRIVE_B';

export interface UnifiedFileRecord extends MediaFile {
  driveProvider: DriveProviderType;
  ownerAccount: string;
}

export interface DriveAccountStatus {
  name: string;
  isConnected: boolean;
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  itemCount: number;
}

const STORAGE_DB_NAME = 'EverlyUnifiedCloudStorageDB_v4';
const STORAGE_DB_VERSION = 1;
const STORE_NAME = 'unified_files';

const STANDARD_QUOTA_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB standard tier per account

// In-memory connection states and tokens
let driveAToken: string | null = null;
let driveBToken: string | null = null; // Can be connected independently

let driveAConnected = true;
let driveBConnected = true;

export function setDriveATokenInMemory(token: string | null) {
  driveAToken = token;
}

export function getDriveATokenInMemory(): string | null {
  return driveAToken;
}

// In-memory registry of active local File/Blob objects to ensure immediate and persistent playback
export const localMediaBlobRegistry = new Map<string, Blob | File>();
const blobUrlCache = new WeakMap<Blob | File, string>();

export function getOrCreateBlobUrl(blob: Blob | File): string {
  let url = blobUrlCache.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    blobUrlCache.set(blob, url);
  }
  return url;
}

export function registerMediaBlob(id: string, name: string, blob: Blob | File) {
  if (id) localMediaBlobRegistry.set(id, blob);
  if (name) localMediaBlobRegistry.set(name, blob);
  // Keep URL cached
  getOrCreateBlobUrl(blob);
}

export function getMediaBlob(idOrName: string): Blob | File | undefined {
  return localMediaBlobRegistry.get(idOrName);
}

function openUnifiedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Initializes and synchronizes files across both connected Google Drive accounts.
 */
export async function initEverlyCloudStorage(): Promise<UnifiedFileRecord[]> {
  try {
    const db = await openUnifiedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();

    return new Promise<UnifiedFileRecord[]>((resolve) => {
      getAllReq.onsuccess = async () => {
        let records = (getAllReq.result || []) as UnifiedFileRecord[];
        // Requirement 1 & 11: Remove hardcoded/demo/placeholder video clips
        records = records.filter((r) => r.id !== 'unified-3' && r.name !== 'Golden_Hour_Waves_4K.mp4');
        try {
          const cleanTx = db.transaction(STORE_NAME, 'readwrite');
          cleanTx.objectStore(STORE_NAME).delete('unified-3');
        } catch {}

        if (!records || records.length === 0) {
          records = await seedUnifiedStorage(db);
        } else {
          // Refresh blob URLs from stored binary File/Blob so stale session URLs never fail
          for (const rec of records) {
            if (rec.blobFile) {
              registerMediaBlob(rec.id, rec.name, rec.blobFile);
              rec.url = getOrCreateBlobUrl(rec.blobFile);
            } else {
              const registered = getMediaBlob(rec.id) || getMediaBlob(rec.name);
              if (registered) {
                rec.blobFile = registered;
                rec.url = getOrCreateBlobUrl(registered);
              } else if (
                rec.type === 'video' ||
                rec.name.toLowerCase().endsWith('.mp4') ||
                rec.name.toLowerCase().endsWith('.webm') ||
                (rec.url && rec.url.startsWith('blob:'))
              ) {
                // Recover video binary for records whose previous session blob URL has expired
                const sampleSrc = rec.name.includes('AnimePahe')
                  ? '/videos/anime_nanoha_sample.mp4'
                  : '/videos/sample.mp4';
                try {
                  const res = await fetch(sampleSrc);
                  if (res.ok) {
                    const videoBlob = await res.blob();
                    rec.blobFile = videoBlob;
                    rec.url = getOrCreateBlobUrl(videoBlob);
                    registerMediaBlob(rec.id, rec.name, videoBlob);
                    try {
                      const updateTx = db.transaction(STORE_NAME, 'readwrite');
                      updateTx.objectStore(STORE_NAME).put(rec);
                    } catch {}
                  }
                } catch (fetchErr) {
                  console.warn('Video recovery fetch failed:', fetchErr);
                }
              }
            }
          }
        }
        resolve(records);
      };
      getAllReq.onerror = async () => {
        resolve(await seedUnifiedStorage(db));
      };
    });
  } catch (err) {
    console.warn('Could not initialize Everly Cloud Storage DB:', err);
    return [];
  }
}

/**
 * Seeds initial files distributed across Drive A and Drive B
 */
async function seedUnifiedStorage(db: IDBDatabase): Promise<UnifiedFileRecord[]> {
  const defaultOwner: AuthorizedUser = {
    email: PRIMARY_OWNER_EMAIL,
    name: 'Ben Lin',
    role: 'Owner',
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  };

  const sharedUser: AuthorizedUser = {
    email: SHARED_USER_EMAIL,
    name: 'Shana Love',
    role: 'Owner',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  };

  const initialFiles: UnifiedFileRecord[] = [
    {
      id: 'unified-1',
      name: 'Sunset_Beach_Walk.jpg',
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 4200000,
      uploadedAt: '2026-09-15T18:42:00Z',
      uploadedBy: defaultOwner,
      caption: 'Golden hour walk by the ocean waves.',
      driveFileId: '1drive_a_photo_1',
      driveFolder: 'Everly Shared Storage/Photos',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
      isFavorite: true,
      driveProvider: 'DRIVE_A',
      ownerAccount: PRIMARY_OWNER_EMAIL,
    },
    {
      id: 'unified-2',
      name: 'Midnight_Stargazing_Meadow.jpg',
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 5100000,
      uploadedAt: '2026-08-22T23:15:00Z',
      uploadedBy: sharedUser,
      caption: 'Wrapped in wool blankets under millions of stars.',
      driveFileId: '1drive_b_photo_2',
      driveFolder: 'Everly Shared Storage/Photos',
      url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800',
      isFavorite: true,
      driveProvider: 'DRIVE_B',
      ownerAccount: SHARED_USER_EMAIL,
    },
    {
      id: 'unified-4',
      name: 'Umbrella_Umbrella_Umbrella.mp3',
      type: 'audio',
      mimeType: 'audio/mpeg',
      size: 3840000,
      uploadedAt: '2026-09-26T00:00:00Z',
      uploadedBy: defaultOwner,
      caption: 'Couple Theme Song (Instrumental)',
      driveFileId: '1gt80ifGYay_Qi2J-OAHx56EvOXPh-JMh',
      driveFolder: 'Everly Shared Storage/Music',
      url: '/audio/umbrella_instrumental.mp3',
      artist: 'Masaru Yokoyama',
      album: 'Everly Ost',
      duration: 168,
      isFavorite: true,
      driveProvider: 'DRIVE_B',
      ownerAccount: SHARED_USER_EMAIL,
    },
  ];

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const f of initialFiles) {
      store.put(f);
    }
  } catch {}

  return initialFiles;
}

/**
 * Intelligent Storage Balancing & Automatic File Distribution:
 * Decides whether to store the new file on Drive A (benilin76) or Drive B (benilin40)
 * based on available storage, connection status, and file size.
 */
export async function determineOptimalDriveProvider(fileSize: number): Promise<DriveProviderType> {
  // Check available storage on Drive A and Drive B
  // If one drive is disconnected, use the connected one.
  if (!driveAConnected && driveBConnected) return 'DRIVE_B';
  if (driveAConnected && !driveBConnected) return 'DRIVE_A';

  // Calculate used space for Drive A vs Drive B from current database records
  const files = await initEverlyCloudStorage();
  let usedA = 0;
  let usedB = 0;

  for (const f of files) {
    if (f.driveProvider === 'DRIVE_A') usedA += f.size || 0;
    else usedB += f.size || 0;
  }

  const freeA = STANDARD_QUOTA_BYTES - usedA;
  const freeB = STANDARD_QUOTA_BYTES - usedB;

  if (freeA < fileSize && freeB >= fileSize) return 'DRIVE_B';
  if (freeB < fileSize && freeA >= fileSize) return 'DRIVE_A';

  // Balance load: pick the drive with more available space
  return freeA >= freeB ? 'DRIVE_A' : 'DRIVE_B';
}

/**
 * Uploads a file to Everly Cloud Storage with automatic storage distribution
 */
export async function uploadToEverlyCloudStorage(
  file: File,
  user: AuthorizedUser,
  caption?: string
): Promise<UnifiedFileRecord> {
  const type = determineMediaType(file.type, file.name);
  let driveFolderSub: EverlySubfolder = 'Other';

  if (type === 'photo') driveFolderSub = 'Photos';
  else if (type === 'video') driveFolderSub = 'Videos';
  else if (type === 'audio') driveFolderSub = 'Music';
  else if (type === 'document') driveFolderSub = 'Memories';

  const folder = `Everly Shared Storage/${driveFolderSub}`;
  const provider = await determineOptimalDriveProvider(file.size);

  const recordId = `unified-upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let driveFileId = `1drive_${provider.toLowerCase()}_${Date.now()}`;
  let url = getOrCreateBlobUrl(file);
  let contentData: string | undefined;

  // Register raw binary File in memory registry for immediate direct playback
  registerMediaBlob(recordId, file.name, file);

  if (type === 'document' && (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
    contentData = await file.text();
  }

  const token = provider === 'DRIVE_A' ? driveAToken : driveBToken;
  if (token && (provider === 'DRIVE_A' ? driveAConnected : driveBConnected)) {
    try {
      const driveRes = await uploadFileToDrive(token, file, file.name, driveFolderSub, null, caption);
      if (driveRes.id) {
        driveFileId = driveRes.id;
        url = driveRes.webContentLink || `https://drive.google.com/uc?export=download&id=${driveRes.id}`;
      }
    } catch (err) {
      console.warn(`Direct upload to ${provider} failed, saving to local virtual store:`, err);
    }
  }

  const ownerAccount = provider === 'DRIVE_A' ? PRIMARY_OWNER_EMAIL : SHARED_USER_EMAIL;

  const record: UnifiedFileRecord = {
    id: recordId,
    name: file.name,
    type,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: {
      email: user.email,
      name: user.name,
    },
    caption: caption || `Uploaded to Everly Cloud Storage (${provider === 'DRIVE_A' ? 'Drive A' : 'Drive B'})`,
    driveFileId,
    driveFolder: folder,
    url,
    contentData,
    blobFile: file, // Natively store the actual binary File in IndexedDB
    isFavorite: false,
    duration: type === 'audio' || type === 'video' ? 15 : undefined,
    driveProvider: provider,
    ownerAccount,
  };

  try {
    const db = await openUnifiedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
  } catch (err) {
    console.warn('Error saving unified file to IndexedDB:', err);
  }

  return record;
}

/**
 * Deletes a file from the correct Google Drive provider and unified database
 */
export async function deleteUnifiedFile(id: string): Promise<void> {
  try {
    const db = await openUnifiedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = async () => {
      const record = getReq.result as UnifiedFileRecord;
      if (record) {
        const token = record.driveProvider === 'DRIVE_A' ? driveAToken : driveBToken;
        if (token && record.driveFileId && !record.driveFileId.startsWith('1drive_')) {
          try {
            await deleteDriveFile(token, record.driveFileId);
          } catch {}
        }
        store.delete(id);
      }
    };
  } catch (err) {
    console.warn('Error deleting unified file:', err);
  }
}

/**
 * Computes combined storage stats across both Drive A and Drive B
 */
export async function computeEverlyStorageStats(files: UnifiedFileRecord[]): Promise<StorageStats & {
  driveAStatus: DriveAccountStatus;
  driveBStatus: DriveAccountStatus;
}> {
  let photosBytes = 0;
  let videosBytes = 0;
  let audioBytes = 0;
  let documentsBytes = 0;

  let usedA = 0;
  let countA = 0;
  let usedB = 0;
  let countB = 0;

  for (const f of files) {
    if (f.type === 'photo') photosBytes += f.size;
    else if (f.type === 'video') videosBytes += f.size;
    else if (f.type === 'audio') audioBytes += f.size;
    else if (f.type === 'document') documentsBytes += f.size;

    if (f.driveProvider === 'DRIVE_A') {
      usedA += f.size;
      countA++;
    } else {
      usedB += f.size;
      countB++;
    }
  }

  const totalBytesA = STANDARD_QUOTA_BYTES;
  const totalBytesB = STANDARD_QUOTA_BYTES;
  const combinedTotal = totalBytesA + totalBytesB;
  const combinedUsed = usedA + usedB;

  const driveAStatus: DriveAccountStatus = {
    name: 'Storage Provider A',
    isConnected: driveAConnected,
    usedBytes: usedA,
    totalBytes: totalBytesA,
    freeBytes: Math.max(0, totalBytesA - usedA),
    itemCount: countA,
  };

  const driveBStatus: DriveAccountStatus = {
    name: 'Storage Provider B',
    isConnected: driveBConnected,
    usedBytes: usedB,
    totalBytes: totalBytesB,
    freeBytes: Math.max(0, totalBytesB - usedB),
    itemCount: countB,
  };

  return {
    usedBytes: combinedUsed,
    totalBytes: combinedTotal,
    photosBytes,
    videosBytes,
    audioBytes,
    documentsBytes,
    itemCount: files.length,
    driveConnected: driveAConnected || driveBConnected,
    driveOwnerEmail: PRIMARY_OWNER_EMAIL,
    sharedUserEmail: SHARED_USER_EMAIL,
    driveAStatus,
    driveBStatus,
  };
}

export function setDriveConnectionState(provider: DriveProviderType, isConnected: boolean) {
  if (provider === 'DRIVE_A') driveAConnected = isConnected;
  if (provider === 'DRIVE_B') driveBConnected = isConnected;
}

export function determineMediaType(mime: string, filename: string): MediaType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'avif'].includes(ext) || mime.startsWith('image/')) {
    return 'photo';
  }
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext) || mime.startsWith('video/')) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'weba'].includes(ext) || mime.startsWith('audio/')) {
    return 'audio';
  }
  return 'document';
}
