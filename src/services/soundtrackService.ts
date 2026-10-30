/**
 * Everly Music Library & Background Soundtrack Engine
 * Simple, robust audio architecture:
 * UPLOAD SONGS → SHOW SONGS → PLAY SONGS
 *
 * Persists raw audio Blobs and authentic metadata in IndexedDB.
 * Ensures uploaded songs are immediately playable and stay available after browser refresh.
 */

import { extractAudioFileMetadata } from './audioMetadataService';

export interface BackgroundTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  format: string; // e.g. MP3, WAV, M4A
  size: number; // in bytes
  dateAdded: string;
  url: string; // Playable blob/object URL
  isBackground?: boolean;
}

export interface BackgroundMusicState {
  musicEnabled: boolean;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  rememberPreference: boolean;
  currentTrackId: string | null;
  isPlaying: boolean;
  loop: boolean;
}

const DB_NAME = 'EverlyMusicDB_v3';
const DB_VERSION = 1;
const STORE_NAME = 'audio_library';
const ACTIVE_BG_STORAGE_KEY = 'everly_active_background_song_id_v3';
const MUSIC_STATE_STORAGE_KEY = 'everly_music_state_v3';

type MusicLibraryListener = (library: BackgroundTrack[], activeBgTrack: BackgroundTrack | null) => void;
const listeners = new Set<MusicLibraryListener>();

// In-memory cache of tracks with live object URLs
let cachedLibrary: BackgroundTrack[] = [];
let isDbInitialized = false;

function openMusicDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported'));
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Initializes the Music Library from IndexedDB on startup.
 * Converts stored Blobs into live, playable object URLs.
 */
export async function initMusicLibrary(): Promise<BackgroundTrack[]> {
  try {
    const db = await openMusicDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();

    return new Promise((resolve) => {
      getAllReq.onsuccess = () => {
        const records = (getAllReq.result || []) as Array<{
          id: string;
          title: string;
          artist: string;
          album?: string;
          duration: number;
          format: string;
          size: number;
          dateAdded: string;
          blob?: Blob;
          url?: string;
        }>;

        const activeBgId = localStorage.getItem(ACTIVE_BG_STORAGE_KEY);

        cachedLibrary = records.map((rec) => {
          let playableUrl = rec.url || '';
          if (rec.blob) {
            try {
              playableUrl = URL.createObjectURL(rec.blob);
            } catch {}
          }
          return {
            id: rec.id,
            title: rec.title || 'Untitled Song',
            artist: rec.artist || 'Unknown Artist',
            album: rec.album,
            duration: rec.duration || 0,
            format: rec.format || 'MP3',
            size: rec.size || 0,
            dateAdded: rec.dateAdded || new Date().toISOString().split('T')[0],
            url: playableUrl,
            isBackground: rec.id === activeBgId,
          };
        });

        isDbInitialized = true;
        notifyListeners();
        resolve(cachedLibrary);
      };

      getAllReq.onerror = () => {
        isDbInitialized = true;
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('Could not initialize audio library from IndexedDB:', err);
    isDbInitialized = true;
    return [];
  }
}

/**
 * Uploads and processes a single audio file:
 * 1. Reads actual metadata (Title, Artist, Duration, Format).
 * 2. Stores the binary Blob in IndexedDB.
 * 3. Creates an immediate playable object URL.
 * 4. Adds to library and persists.
 */
export async function uploadAudioTrack(file: File): Promise<BackgroundTrack> {
  const metadata = await extractAudioFileMetadata(file);
  const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const objectUrl = URL.createObjectURL(file);
  const dateAdded = new Date().toISOString().split('T')[0];

  const recordToStore = {
    id: trackId,
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    duration: metadata.duration,
    format: metadata.format,
    size: metadata.size,
    dateAdded,
    blob: file, // Store binary blob in IndexedDB
  };

  try {
    const db = await openMusicDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(recordToStore);
  } catch (err) {
    console.warn('Error saving audio blob to IndexedDB:', err);
  }

  const newTrack: BackgroundTrack = {
    id: trackId,
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    duration: metadata.duration,
    format: metadata.format,
    size: metadata.size,
    dateAdded,
    url: objectUrl,
    isBackground: false,
  };

  cachedLibrary = [newTrack, ...cachedLibrary];

  // If this is the very first song uploaded, auto-set as background music
  if (cachedLibrary.length === 1) {
    setBackgroundSong(newTrack.id);
  } else {
    notifyListeners();
  }

  return newTrack;
}

/**
 * Uploads multiple audio files simultaneously
 */
export async function uploadMultipleAudioTracks(files: FileList | File[]): Promise<BackgroundTrack[]> {
  const uploaded: BackgroundTrack[] = [];
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    try {
      const track = await uploadAudioTrack(file);
      uploaded.push(track);
    } catch (err) {
      console.warn('Failed to process audio file:', file.name, err);
    }
  }

  return uploaded;
}

/**
 * Deletes a track from the library and IndexedDB
 */
export async function deleteAudioTrack(trackId: string): Promise<void> {
  try {
    const db = await openMusicDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(trackId);
  } catch (err) {
    console.warn('Error deleting track from IndexedDB:', err);
  }

  const activeBgId = localStorage.getItem(ACTIVE_BG_STORAGE_KEY);
  if (activeBgId === trackId) {
    localStorage.removeItem(ACTIVE_BG_STORAGE_KEY);
  }

  cachedLibrary = cachedLibrary.filter((t) => t.id !== trackId);

  // If there are other tracks, set the next one as background
  if (activeBgId === trackId && cachedLibrary.length > 0) {
    setBackgroundSong(cachedLibrary[0].id);
  } else {
    notifyListeners();
  }
}

/**
 * Sets a specific track as the active Background Music
 */
export function setBackgroundSong(trackId: string): void {
  localStorage.setItem(ACTIVE_BG_STORAGE_KEY, trackId);
  cachedLibrary = cachedLibrary.map((t) => ({
    ...t,
    isBackground: t.id === trackId,
  }));
  saveBackgroundMusicState({ musicEnabled: true, currentTrackId: trackId });
  notifyListeners();
}

/**
 * Removes the currently set Background Music
 */
export function removeBackgroundSong(): void {
  localStorage.removeItem(ACTIVE_BG_STORAGE_KEY);
  cachedLibrary = cachedLibrary.map((t) => ({
    ...t,
    isBackground: false,
  }));
  saveBackgroundMusicState({ musicEnabled: false, currentTrackId: null });
  notifyListeners();
}

/**
 * Returns the currently active background track (if any)
 */
export function getActiveBackgroundTrack(): BackgroundTrack | null {
  const activeId = localStorage.getItem(ACTIVE_BG_STORAGE_KEY);
  if (!activeId) return cachedLibrary[0] || null;
  return cachedLibrary.find((t) => t.id === activeId) || cachedLibrary[0] || null;
}

/**
 * Get in-memory cached library
 */
export function getMusicLibrary(): BackgroundTrack[] {
  return cachedLibrary;
}

/**
 * Subscribe to Music Library changes
 */
export function subscribeMusicLibrary(listener: MusicLibraryListener): () => void {
  listeners.add(listener);
  if (!isDbInitialized) {
    initMusicLibrary().then(() => {
      listener(cachedLibrary, getActiveBackgroundTrack());
    });
  } else {
    listener(cachedLibrary, getActiveBackgroundTrack());
  }
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  const activeBg = getActiveBackgroundTrack();
  listeners.forEach((fn) => {
    try {
      fn(cachedLibrary, activeBg);
    } catch (e) {
      console.warn('Error in music library listener:', e);
    }
  });
}

/**
 * Background Music State Persistence
 */
export const DEFAULT_MUSIC_STATE: BackgroundMusicState = {
  musicEnabled: true,
  volume: 0.5,
  isMuted: false,
  rememberPreference: true,
  currentTrackId: null,
  isPlaying: false,
  loop: true,
};

export function getBackgroundMusicState(): BackgroundMusicState {
  try {
    const raw = localStorage.getItem(MUSIC_STATE_STORAGE_KEY);
    if (raw) {
      return {
        ...DEFAULT_MUSIC_STATE,
        ...JSON.parse(raw),
      };
    }
  } catch {}
  return DEFAULT_MUSIC_STATE;
}

export function saveBackgroundMusicState(partial: Partial<BackgroundMusicState>): BackgroundMusicState {
  const current = getBackgroundMusicState();
  const updated = {
    ...current,
    ...partial,
  };
  try {
    localStorage.setItem(MUSIC_STATE_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

// Format duration helper (mm:ss)
export function formatAudioDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Compatibility exports
export type SoundtrackConfig = {
  trackTitle: string;
  trackArtist: string;
  trackAlbum: string;
  driveFileId: string;
  sourceType: 'drive' | 'local' | 'custom' | 'upload';
  customUrl?: string;
  volume: number;
  isMuted: boolean;
  loop?: boolean;
};

export const getDirectDriveUcUrl = (id: string) => id;

export function getSoundtrackConfig(): SoundtrackConfig {
  const track = getActiveBackgroundTrack();
  const state = getBackgroundMusicState();
  return {
    trackTitle: track?.title || 'No song selected',
    trackArtist: track?.artist || 'Unknown Artist',
    trackAlbum: track?.album || '',
    driveFileId: '',
    sourceType: 'upload',
    customUrl: track?.url || '',
    volume: state.volume,
    isMuted: state.isMuted,
    loop: state.loop,
  };
}

export function saveSoundtrackConfig(partial: Partial<SoundtrackConfig>): void {
  if (partial.volume !== undefined || partial.isMuted !== undefined) {
    saveBackgroundMusicState({
      volume: partial.volume,
      isMuted: partial.isMuted,
    });
  }
}

export function subscribeSoundtrack(listener: (config: SoundtrackConfig) => void): () => void {
  return subscribeMusicLibrary(() => {
    listener(getSoundtrackConfig());
  });
}

export function subscribeBackgroundMusic(listener: (state: BackgroundMusicState, library: BackgroundTrack[]) => void): () => void {
  return subscribeMusicLibrary((lib) => {
    listener(getBackgroundMusicState(), lib);
  });
}

export const setActiveBackgroundTrack = setBackgroundSong;
export const getCurrentBackgroundTrack = () => getActiveBackgroundTrack() || {
  id: 'none',
  title: 'No Song Selected',
  artist: 'Unknown Artist',
  duration: 0,
  format: 'MP3',
  size: 0,
  dateAdded: '',
  url: '',
};

export const resolveTrackPlayableUrl = (track: BackgroundTrack) => track.url || '';
export const saveMusicLibrary = () => {};
export const addTrackToLibrary = (track: any) => track;
export const removeTrackFromLibrary = deleteAudioTrack;
export const reorderLibrary = () => cachedLibrary;
export const extractDriveFileId = (input: string) => null;
export const getDriveAudioStreamUrl = (fileId: string) => fileId;
export const processAudioUploadFile = async (file: File) => {
  const t = await uploadAudioTrack(file);
  return { url: t.url, duration: t.duration };
};
export const DEFAULT_DRIVE_FILE_ID = '';
export const INITIAL_BACKGROUND_LIBRARY: BackgroundTrack[] = [];
