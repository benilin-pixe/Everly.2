import { MediaFile, MediaType, StorageStats, AuthorizedUser, MemoryNote } from '../types';
import { generateLofiWavBlob } from './audioSynthesizer';
import { getStandardMimeType } from './driveStreamService';
import {
  uploadFileToDrive,
  deleteDriveFile,
  renameDriveFile,
  initializeEverlyStorage,
  getDriveStorageQuota,
  listDriveFiles,
  EverlySubfolder,
} from './googleDriveService';
import { PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL, getStoredAccessToken } from './authService';
import { uploadAudioTrack } from './soundtrackService';

import beachSunsetImg from '../assets/images/couple_sunset_beach_1790404111557.jpg';
import stargazingImg from '../assets/images/couple_stargazing_1790404124840.jpg';
import cozyCafeImg from '../assets/images/couple_cozy_cafe_1790404136832.jpg';
import roadtripImg from '../assets/images/couple_roadtrip_view_1790404147577.jpg';

const DB_NAME = 'EverlySharedDriveDB_v3';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';
const TOTAL_STORAGE_QUOTA = 15 * 1024 * 1024 * 1024; // 15 GB Google Drive standard tier

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateDriveId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '1drive_';
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function initStorage(): Promise<MediaFile[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const getAllReq = store.getAll();

  return new Promise<MediaFile[]>((resolve) => {
    getAllReq.onsuccess = async () => {
      let files = getAllReq.result as MediaFile[];
      if (!files || files.length === 0) {
        files = await seedInitialFiles();
      }
      resolve(files);
    };
    getAllReq.onerror = async () => {
      resolve(await seedInitialFiles());
    };
  });
}

async function seedInitialFiles(): Promise<MediaFile[]> {
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

  const audioBlob1 = generateLofiWavBlob('piano', 18);
  const audioBlob2 = generateLofiWavBlob('sunset', 18);
  const audioBlob3 = generateLofiWavBlob('ambient', 18);
  const audioUrl1 = URL.createObjectURL(audioBlob1);
  const audioUrl2 = URL.createObjectURL(audioBlob2);
  const audioUrl3 = URL.createObjectURL(audioBlob3);

  const initialFiles: MediaFile[] = [
    // 1. Photos
    {
      id: 'photo-1',
      name: 'Sunset_Beach_Walk.jpg',
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 4200000,
      uploadedAt: '2026-09-15T18:42:00Z',
      uploadedBy: defaultOwner,
      caption: 'Golden hour walk by the ocean waves. One of our favorite afternoons.',
      driveFileId: generateDriveId(),
      driveFolder: 'Everly Shared Storage/Photos',
      url: beachSunsetImg,
      isFavorite: true,
    },
    {
      id: 'photo-2',
      name: 'Midnight_Stargazing_Meadow.jpg',
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 5100000,
      uploadedAt: '2026-08-22T23:15:00Z',
      uploadedBy: sharedUser,
      caption: 'Wrapped in wool blankets under millions of stars. Fairy lights glow.',
      driveFileId: generateDriveId(),
      driveFolder: 'Everly Shared Storage/Photos',
      url: stargazingImg,
      isFavorite: true,
    },
    {
      id: 'photo-3',
      name: 'Cozy_Neighborhood_Cafe.jpg',
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 3800000,
      uploadedAt: '2026-07-04T10:30:00Z',
      uploadedBy: sharedUser,
      caption: 'Our cozy corner booth at the neighborhood cafe with matching warm lattes.',
      driveFileId: generateDriveId(),
      driveFolder: 'Everly Shared Storage/Photos',
      url: cozyCafeImg,
      isFavorite: false,
    },
    {
      id: 'photo-4',
      name: 'Coastal_Highway_Roadtrip.jpg',
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 4900000,
      uploadedAt: '2026-06-18T16:20:00Z',
      uploadedBy: defaultOwner,
      caption: 'Misty coastal cliffs, pine trees, and our road trip soundtrack playing.',
      driveFileId: generateDriveId(),
      driveFolder: 'Everly Shared Storage/Photos',
      url: roadtripImg,
      isFavorite: true,
    },

    // 2. Videos: Clean empty installation (Requirement 1: zero hardcoded demo clips)


    // 3. Documents & Vault
    {
      id: 'doc-1',
      name: 'Couple_Bucket_List_2026.md',
      type: 'document',
      mimeType: 'text/markdown',
      size: 4500,
      uploadedAt: '2026-09-05T11:20:00Z',
      uploadedBy: sharedUser,
      caption: 'Everything we dream of experiencing, building, and exploring together.',
      driveFileId: generateDriveId(),
      driveFolder: 'Everly Shared Storage/Memories',
      url: '',
      isFavorite: true,
      contentData: `# 🌟 Our Couple Bucket List (2026 - 2027)
*Curated together with love in Everly Shared Storage*

### ✈️ Adventures & Travel
- [x] Rent an oceanfront cabin in Big Sur for 4 days
- [ ] Watch the Aurora Borealis from a glass igloo in Tromsø, Norway
- [ ] Take a hot air balloon flight over Cappadocia at dawn
- [ ] Road trip along the Amalfi Coast in a vintage convertible

### 🏡 Cozy Milestones
- [x] Host our first candlelit dinner party in our new space
- [ ] Build a custom cedarwood bookshelf together
- [ ] Plant a terrace Japanese maple and herb garden
- [ ] Frame our favorite printed photos in the hallway

### 🎶 Creative & Play
- [x] Record our signature instrumental theme song
- [ ] Take a pottery wheel masterclass together
- [ ] Camp under the Perseid meteor shower with warm cider
`,
    },
    {
      id: 'doc-2',
      name: 'Anniversary_Trip_Itinerary.md',
      type: 'document',
      mimeType: 'text/markdown',
      size: 6200,
      uploadedAt: '2026-08-28T09:00:00Z',
      uploadedBy: defaultOwner,
      caption: 'Detailed day-by-day plan for our oceanfront cabin retreat.',
      driveFileId: generateDriveId(),
      driveFolder: 'Everly Shared Storage/Memories',
      url: '',
      isFavorite: false,
      contentData: `# 🌊 Oceanfront Cabin Anniversary Retreat
**Dates:** October 14 - October 18, 2026  
**Location:** Sea Ranch, California  
**Drive Sync:** \`Everly Shared Storage/Memories/Anniversary_Trip_Itinerary.md\`

---

### Day 1 — Thursday (Arrival & Unwind)
- **14:00** Pick up fresh sourdough, local cheeses, and fig spread in Point Reyes.
- **16:30** Check into the bluff cabin; build the first fireplace fire.
- **18:15** Golden hour wine tasting on the private deck watching harbor seals.

### Day 2 — Friday (Coastal Exploration)
- **09:30** Pour-over coffee and morning beach walk down the private trail.
- **13:00** Coastal hike through the cypress tree grove tunnel.
- **19:00** Stargazing from the cedar hot tub with our ambient music playlist.
`,
    },
  ];

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const file of initialFiles) {
      store.put(file);
    }
  } catch (err) {
    console.warn('Could not persist to IndexedDB:', err);
  }

  return initialFiles;
}

export async function addUploadedFile(
  file: File,
  user: AuthorizedUser,
  caption?: string
): Promise<MediaFile> {
  const type = determineMediaType(file.type, file.name);
  let driveFolderSub: EverlySubfolder = 'Other';

  if (type === 'photo') driveFolderSub = 'Photos';
  else if (type === 'video') driveFolderSub = 'Videos';
  else if (type === 'audio') driveFolderSub = 'Music';
  else if (type === 'document') driveFolderSub = 'Memories';

  const folder = `Everly Shared Storage/${driveFolderSub}`;
  let driveId = generateDriveId();
  let url = URL.createObjectURL(file);
  let contentData: string | undefined;

  if (type === 'document' && (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
    contentData = await file.text();
  }

  // If user has an active Google Drive access token, perform live Google Drive upload
  const accessToken = user.accessToken || getStoredAccessToken();
  if (accessToken) {
    try {
      const driveRes = await uploadFileToDrive(accessToken, file, file.name, driveFolderSub, null, caption);
      if (driveRes.id) {
        driveId = driveRes.id;
        url = driveRes.webContentLink || `https://drive.google.com/uc?export=download&id=${driveRes.id}`;
      }
    } catch (driveErr) {
      console.warn('Direct Google Drive upload failed, saving to local offline storage:', driveErr);
    }
  }

  let duration = type === 'video' ? 12 : undefined;

  if (type === 'audio') {
    try {
      const audioTrack = await uploadAudioTrack(file);
      duration = audioTrack.duration;
    } catch {}
  }

  const mediaFile: MediaFile = {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    type,
    mimeType: getStandardMimeType(file.name, file.type),
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: {
      email: user.email,
      name: user.name,
    },
    caption: caption || `Uploaded to ${folder} by ${user.name}`,
    driveFileId: driveId,
    driveFolder: folder,
    url,
    contentData,
    isFavorite: false,
    duration,
  };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(mediaFile);
  } catch (err) {
    console.warn('Error saving to IndexedDB:', err);
  }

  return mediaFile;
}

export async function deleteMediaFile(id: string, driveFileId?: string, accessToken?: string): Promise<void> {
  // If accessToken provided and driveFileId is a real Drive ID, attempt deletion on Drive
  if (accessToken && driveFileId && !driveFileId.startsWith('1drive_')) {
    try {
      await deleteDriveFile(accessToken, driveFileId);
    } catch (err) {
      console.warn('Google Drive delete error:', err);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (err) {
    console.warn('Error deleting from IndexedDB:', err);
  }
}

export async function renameMediaFile(id: string, newName: string, driveFileId?: string, accessToken?: string): Promise<boolean> {
  if (accessToken && driveFileId && !driveFileId.startsWith('1drive_')) {
    try {
      await renameDriveFile(accessToken, driveFileId, newName);
    } catch (err) {
      console.warn('Google Drive rename error:', err);
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const item = req.result as MediaFile;
        if (item) {
          item.name = newName;
          store.put(item);
          resolve(true);
        } else {
          resolve(false);
        }
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function toggleFileFavorite(id: string, currentStatus: boolean): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const item = req.result as MediaFile;
        if (item) {
          item.isFavorite = !currentStatus;
          store.put(item);
          resolve(item.isFavorite);
        } else {
          resolve(currentStatus);
        }
      };
      req.onerror = () => resolve(currentStatus);
    });
  } catch {
    return currentStatus;
  }
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

export function computeStorageStats(files: MediaFile[], driveQuota?: { usageBytes: number; limitBytes: number } | null): StorageStats {
  let photosBytes = 0;
  let videosBytes = 0;
  let audioBytes = 0;
  let documentsBytes = 0;

  for (const f of files) {
    if (f.type === 'photo') photosBytes += f.size;
    else if (f.type === 'video') videosBytes += f.size;
    else if (f.type === 'audio') audioBytes += f.size;
    else if (f.type === 'document') documentsBytes += f.size;
  }

  const localUsed = photosBytes + videosBytes + audioBytes + documentsBytes;
  const usedBytes = driveQuota ? driveQuota.usageBytes : localUsed;
  const totalBytes = driveQuota ? driveQuota.limitBytes : TOTAL_STORAGE_QUOTA;

  const token = getStoredAccessToken();

  return {
    usedBytes,
    totalBytes,
    photosBytes,
    videosBytes,
    audioBytes,
    documentsBytes,
    itemCount: files.length,
    driveConnected: Boolean(token),
    driveOwnerEmail: PRIMARY_OWNER_EMAIL,
    sharedUserEmail: SHARED_USER_EMAIL,
  };
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function triggerDownload(file: MediaFile) {
  let downloadUrl = file.url;
  let tempUrl: string | null = null;
  if (file.blobFile) {
    tempUrl = URL.createObjectURL(file.blobFile);
    downloadUrl = tempUrl;
  }
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (tempUrl) {
    setTimeout(() => URL.revokeObjectURL(tempUrl!), 1000);
  }
}

// ================================================================
// SHARED MEMORY BOARD / MICRO-JOURNAL OPERATIONS
// ================================================================
const MEMORY_NOTES_KEY = 'everly_memory_board_notes_v3';

const SEED_MEMORY_NOTES: MemoryNote[] = [];

export function getMemoryNotes(): MemoryNote[] {
  try {
    const raw = localStorage.getItem(MEMORY_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read memory notes:', err);
  }
  return [];
}

export function saveMemoryNotes(notes: MemoryNote[]): void {
  try {
    localStorage.setItem(MEMORY_NOTES_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn('Could not save memory notes:', err);
  }
}

export function addMemoryNote(
  content: string,
  category: MemoryNote['category'],
  colorScheme: MemoryNote['colorScheme'],
  author: AuthorizedUser,
  isPinnedDraft: boolean = false
): MemoryNote {
  const newNote: MemoryNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    content,
    category,
    colorScheme,
    createdAt: new Date().toISOString(),
    isPinned: isPinnedDraft,
    author: {
      email: author.email,
      name: author.name,
      role: author.role,
      avatarColor: author.avatarColor,
      avatarInitials: author.avatarInitials,
    },
    reactions: { '❤️': 1 },
  };

  const existing = getMemoryNotes();
  const updated = [newNote, ...existing];
  saveMemoryNotes(updated);
  return newNote;
}

export function deleteMemoryNote(id: string): MemoryNote[] {
  const existing = getMemoryNotes();
  const updated = existing.filter((n) => n.id !== id);
  saveMemoryNotes(updated);
  return updated;
}

export function togglePinMemoryNote(id: string): MemoryNote[] {
  const existing = getMemoryNotes();
  const updated = existing.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  saveMemoryNotes(updated);
  return updated;
}

export function reactToMemoryNote(id: string, emoji: string): MemoryNote[] {
  const existing = getMemoryNotes();
  const updated = existing.map((n) => {
    if (n.id === id) {
      const reactions = { ...(n.reactions || {}) };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      return { ...n, reactions };
    }
    return n;
  });
  saveMemoryNotes(updated);
  return updated;
}

// Memory Board aliases
export const getStoredMemoryNotes = getMemoryNotes;
export const saveNewMemoryNote = addMemoryNote;
export const addReactionToNote = reactToMemoryNote;
