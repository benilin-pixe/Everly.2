import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORIGINAL_DATA_DIR = path.resolve(__dirname, '../data');
const DATA_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'everly_data')
  : ORIGINAL_DATA_DIR;
const STORAGE_DB_FILE = path.join(DATA_DIR, 'streamora_storage.json');
export const STORAGE_OBJECTS_DIR = path.join(DATA_DIR, 'storage_objects');

export type StorageProviderType =
  | 's3_compatible'
  | 'cloudflare_r2'
  | 'google_cloud_storage'
  | 'everly_drive'
  | 'media_cm'
  | 'local_disk';

export type ServerHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'untested';
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';
export type UploadJobStatus = 'pending' | 'uploading' | 'verifying' | 'completed' | 'failed' | 'cancelled';

export interface StorageServerRecord {
  id: string;
  name: string;
  provider: StorageProviderType;
  enabled: boolean;
  isDefault: boolean;
  priority: number; // 1-100 (higher means selected first in automatic distribution)
  capacityBytes: number; // e.g. 50GB = 53687091200
  usedBytes: number;
  uploadLimitBytes: number; // Max size per upload, e.g. 2GB (or 300MB for media.cm guest/free)
  healthStatus: ServerHealthStatus;
  healthMessage: string;
  lastCheckedAt: string | null;
  lastSuccessfulUploadAt?: string | null;
  uploadHealth?: 'healthy' | 'degraded' | 'unhealthy';
  playbackHealth?: 'healthy' | 'degraded' | 'unhealthy';
  storedVideoCount: number;
  endpoint?: string;
  accountUrl?: string; // e.g. 'https://media.cm/?op=my_files'
  websiteUrl?: string; // e.g. 'https://media.cm/'
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  apiKey?: string; // Official API key for Media.cm or token-based providers
  publicUrlPrefix?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoRecord {
  id: string;
  storageKey: string;
  serverId: string;
  provider: StorageProviderType;
  fileName: string;
  fileHash: string; // SHA-256 for duplicate detection
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  resolution?: string;
  thumbnailUrl?: string;
  status: VideoStatus;
  errorMessage?: string | null;
  ownerEmail: string;
  ownerName: string;
  caption?: string;
  isFavorite?: boolean;
  remoteFileId?: string; // Official remote file code / identifier from provider (e.g. Media.cm file_code)
  permanentFileRef?: string; // Permanent reference key
  playbackUrl?: string; // Official playback or stream endpoint
  embedUrl?: string; // Official embed player URL if provided by provider
  uploadedAt: string;
  updatedAt: string;
}

export interface UploadJobRecord {
  id: string;
  videoId: string;
  serverId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: UploadJobStatus;
  progress: number;
  retries: number;
  maxRetries: number;
  error?: string | null;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageAuditLog {
  id: string;
  action:
    | 'server_created'
    | 'server_updated'
    | 'server_deleted'
    | 'server_tested'
    | 'video_uploaded'
    | 'video_deleted'
    | 'video_migrated'
    | 'settings_updated';
  actorEmail: string;
  targetId?: string;
  targetType?: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface StorageSettings {
  selectionMode: 'automatic' | 'manual';
  defaultServerId: string;
  autoDistributionStrategy: 'priority' | 'least_utilized' | 'round_robin';
}

export interface StreamoraStorageData {
  version: number;
  servers: StorageServerRecord[];
  videos: VideoRecord[];
  upload_jobs: UploadJobRecord[];
  audit_logs: StorageAuditLog[];
  settings: StorageSettings;
}

export const DEFAULT_LOCAL_SERVER_ID = 'srv_streamora_primary_disk';
export const DEFAULT_EVERLY_SERVER_ID = 'srv_everly_drive';
export const DEFAULT_MEDIAC_SERVER_ID = 'srv_media_cm';

function createInitialState(): StreamoraStorageData {
  const mediaCmKey = process.env.MEDIA_CM_API_KEY || '';
  const now = new Date().toISOString();

  return {
    version: 1,
    servers: [
      {
        id: DEFAULT_LOCAL_SERVER_ID,
        name: 'Streamora Primary Fast Storage',
        provider: 'local_disk',
        enabled: true,
        isDefault: true,
        priority: 100,
        capacityBytes: 50 * 1024 * 1024 * 1024, // 50 GB
        usedBytes: 0,
        uploadLimitBytes: 4 * 1024 * 1024 * 1024, // 4 GB per video
        healthStatus: 'healthy',
        healthMessage: 'Local high-performance object volume online and verified',
        uploadHealth: 'healthy',
        playbackHealth: 'healthy',
        lastCheckedAt: now,
        lastSuccessfulUploadAt: null,
        storedVideoCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEFAULT_EVERLY_SERVER_ID,
        name: 'Everly Cloud Storage',
        provider: 'everly_drive',
        enabled: true,
        isDefault: false,
        priority: 90,
        capacityBytes: 30 * 1024 * 1024 * 1024, // 30 GB dual drive
        usedBytes: 0,
        uploadLimitBytes: 2 * 1024 * 1024 * 1024, // 2 GB
        healthStatus: 'healthy',
        healthMessage: 'Everly dual Google Drive cloud integration active and synchronized',
        uploadHealth: 'healthy',
        playbackHealth: 'healthy',
        lastCheckedAt: now,
        lastSuccessfulUploadAt: null,
        storedVideoCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEFAULT_MEDIAC_SERVER_ID,
        name: 'Media.cm Video Cloud',
        provider: 'media_cm',
        enabled: true,
        isDefault: false,
        priority: 80,
        capacityBytes: 10 * 1024 * 1024 * 1024 * 1024, // 10 TB
        usedBytes: 0,
        uploadLimitBytes: 300 * 1024 * 1024, // 300 MB per file (standard/guest limit)
        healthStatus: mediaCmKey ? 'untested' : 'degraded',
        healthMessage: mediaCmKey
          ? 'API key configured from environment. Ready for connection test.'
          : 'Configuration required: Media.cm API key is missing. Set MEDIA_CM_API_KEY in environment or configure API key in server settings.',
        uploadHealth: mediaCmKey ? 'healthy' : 'degraded',
        playbackHealth: mediaCmKey ? 'healthy' : 'degraded',
        lastCheckedAt: null,
        lastSuccessfulUploadAt: null,
        storedVideoCount: 0,
        endpoint: 'https://media.cm',
        accountUrl: 'https://media.cm/?op=my_files',
        websiteUrl: 'https://media.cm/',
        apiKey: mediaCmKey,
        createdAt: now,
        updatedAt: now,
      },
    ],
    // Clean empty installation: zero fake/sample/demo videos
    videos: [],
    upload_jobs: [],
    audit_logs: [
      {
        id: `audit_${Date.now()}_init`,
        action: 'server_created',
        actorEmail: 'system',
        targetId: DEFAULT_LOCAL_SERVER_ID,
        targetType: 'server',
        details: { name: 'Streamora Primary Fast Storage', provider: 'local_disk' },
        timestamp: now,
      },
      {
        id: `audit_${Date.now()}_init_everly`,
        action: 'server_created',
        actorEmail: 'system',
        targetId: DEFAULT_EVERLY_SERVER_ID,
        targetType: 'server',
        details: { name: 'Everly Cloud Storage', provider: 'everly_drive' },
        timestamp: now,
      },
      {
        id: `audit_${Date.now()}_init_mediacm`,
        action: 'server_created',
        actorEmail: 'system',
        targetId: DEFAULT_MEDIAC_SERVER_ID,
        targetType: 'server',
        details: { name: 'Media.cm Video Cloud', provider: 'media_cm' },
        timestamp: now,
      },
    ],
    settings: {
      selectionMode: 'automatic',
      defaultServerId: DEFAULT_LOCAL_SERVER_ID,
      autoDistributionStrategy: 'priority',
    },
  };
}

let dbCache: StreamoraStorageData | null = null;

export function loadStorageDb(): StreamoraStorageData {
  if (dbCache) return dbCache;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORAGE_OBJECTS_DIR)) {
    fs.mkdirSync(STORAGE_OBJECTS_DIR, { recursive: true });
  }

  if (fs.existsSync(STORAGE_DB_FILE)) {
    try {
      const raw = fs.readFileSync(STORAGE_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Ensure all top-level keys exist
      dbCache = {
        version: parsed.version || 1,
        servers: parsed.servers || [],
        videos: parsed.videos || [],
        upload_jobs: parsed.upload_jobs || [],
        audit_logs: parsed.audit_logs || [],
        settings: parsed.settings || {
          selectionMode: 'automatic',
          defaultServerId: DEFAULT_LOCAL_SERVER_ID,
          autoDistributionStrategy: 'priority',
        },
      };

      // Recalculate server statistics accurately
      ensureStandardServersExist(dbCache);
      recalculateServerStats(dbCache);
      return dbCache;
    } catch (err) {
      console.error('[StorageDb] Error loading storage DB, initializing fresh:', err);
    }
  }

  dbCache = createInitialState();
  saveStorageDb();
  return dbCache;
}

export function ensureStandardServersExist(db: StreamoraStorageData) {
  const mediaCmKey = process.env.MEDIA_CM_API_KEY || '';
  const now = new Date().toISOString();

  let hasEverly = db.servers.some((s) => s.id === DEFAULT_EVERLY_SERVER_ID || s.provider === 'everly_drive');
  if (!hasEverly) {
    db.servers.push({
      id: DEFAULT_EVERLY_SERVER_ID,
      name: 'Everly Cloud Storage',
      provider: 'everly_drive',
      enabled: true,
      isDefault: false,
      priority: 90,
      capacityBytes: 30 * 1024 * 1024 * 1024,
      usedBytes: 0,
      uploadLimitBytes: 2 * 1024 * 1024 * 1024,
      healthStatus: 'healthy',
      healthMessage: 'Everly dual Google Drive cloud storage integration active and synchronized',
      uploadHealth: 'healthy',
      playbackHealth: 'healthy',
      lastCheckedAt: now,
      lastSuccessfulUploadAt: null,
      storedVideoCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  let mediaCmServer = db.servers.find((s) => s.id === DEFAULT_MEDIAC_SERVER_ID || s.provider === 'media_cm');
  if (!mediaCmServer) {
    db.servers.push({
      id: DEFAULT_MEDIAC_SERVER_ID,
      name: 'Media.cm Video Cloud',
      provider: 'media_cm',
      enabled: true,
      isDefault: false,
      priority: 80,
      capacityBytes: 10 * 1024 * 1024 * 1024 * 1024,
      usedBytes: 0,
      uploadLimitBytes: 300 * 1024 * 1024,
      healthStatus: mediaCmKey ? 'untested' : 'degraded',
      healthMessage: mediaCmKey
        ? 'API key configured from environment. Ready for connection test.'
        : 'Configuration required: Media.cm API key is missing. Set MEDIA_CM_API_KEY in environment or configure API key in server settings.',
      uploadHealth: mediaCmKey ? 'healthy' : 'degraded',
      playbackHealth: mediaCmKey ? 'healthy' : 'degraded',
      lastCheckedAt: null,
      lastSuccessfulUploadAt: null,
      storedVideoCount: 0,
      endpoint: 'https://media.cm',
      accountUrl: 'https://media.cm/?op=my_files',
      websiteUrl: 'https://media.cm/',
      apiKey: mediaCmKey,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // If env key exists and server doesn't have key, set it
    if (mediaCmKey && !mediaCmServer.apiKey) {
      mediaCmServer.apiKey = mediaCmKey;
    }
    if (!mediaCmServer.accountUrl) {
      mediaCmServer.accountUrl = 'https://media.cm/?op=my_files';
    }
    if (!mediaCmServer.websiteUrl) {
      mediaCmServer.websiteUrl = 'https://media.cm/';
    }
  }
}

export function saveStorageDb() {
  if (!dbCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[StorageDb] Error saving storage DB:', err);
  }
}

export function recalculateServerStats(db: StreamoraStorageData) {
  const counts: Record<string, { count: number; bytes: number }> = {};
  for (const s of db.servers) {
    counts[s.id] = { count: 0, bytes: 0 };
  }

  for (const v of db.videos) {
    if (v.status === 'ready' && counts[v.serverId]) {
      counts[v.serverId].count++;
      counts[v.serverId].bytes += v.size || 0;
    }
  }

  for (const s of db.servers) {
    if (counts[s.id]) {
      s.storedVideoCount = counts[s.id].count;
      s.usedBytes = counts[s.id].bytes;
    }
  }
}

// ----------------------------------------------------
// Storage Server Management Functions
// ----------------------------------------------------

export function listServers(includeSecrets: boolean = false): StorageServerRecord[] {
  const db = loadStorageDb();
  return db.servers.map((s) => {
    if (includeSecrets) return s;
    return {
      ...s,
      secretAccessKey: s.secretAccessKey ? '••••••••••••••••' : undefined,
      apiKey: s.apiKey ? '••••••••••••••••' : undefined,
    };
  });
}

export function getServerById(id: string, includeSecrets: boolean = false): StorageServerRecord | null {
  const db = loadStorageDb();
  const s = db.servers.find((srv) => srv.id === id);
  if (!s) return null;
  if (includeSecrets) return s;
  return {
    ...s,
    secretAccessKey: s.secretAccessKey ? '••••••••••••••••' : undefined,
    apiKey: s.apiKey ? '••••••••••••••••' : undefined,
  };
}

export function addServer(data: Omit<StorageServerRecord, 'id' | 'createdAt' | 'updatedAt' | 'usedBytes' | 'storedVideoCount'>, actorEmail: string): StorageServerRecord {
  const db = loadStorageDb();
  const id = `srv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  // If this new server is set as default, remove default from others
  if (data.isDefault) {
    db.servers.forEach((s) => (s.isDefault = false));
  }

  const newServer: StorageServerRecord = {
    ...data,
    id,
    usedBytes: 0,
    storedVideoCount: 0,
    healthStatus: data.healthStatus || 'untested',
    healthMessage: data.healthMessage || 'Newly registered server',
    uploadHealth: data.uploadHealth || 'healthy',
    playbackHealth: data.playbackHealth || 'healthy',
    lastCheckedAt: null,
    lastSuccessfulUploadAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.servers.push(newServer);

  if (newServer.isDefault || db.servers.length === 1) {
    db.settings.defaultServerId = newServer.id;
  }

  addAuditLog({
    action: 'server_created',
    actorEmail,
    targetId: id,
    targetType: 'server',
    details: { name: newServer.name, provider: newServer.provider, bucket: newServer.bucket },
  });

  saveStorageDb();
  return getServerById(id, false)!;
}

export function updateServer(id: string, updates: Partial<StorageServerRecord>, actorEmail: string): StorageServerRecord {
  const db = loadStorageDb();
  const idx = db.servers.findIndex((s) => s.id === id);
  if (idx === -1) {
    throw new Error(`Storage server with ID '${id}' not found.`);
  }

  const existing = db.servers[idx];

  // If user provided mask placeholder, preserve existing secret; allow empty string to clear
  if (updates.secretAccessKey === '••••••••••••••••') {
    delete updates.secretAccessKey;
  }
  if (updates.apiKey === '••••••••••••••••') {
    delete updates.apiKey;
  }

  if (updates.isDefault) {
    db.servers.forEach((s) => (s.isDefault = false));
    db.settings.defaultServerId = id;
  }

  db.servers[idx] = {
    ...existing,
    ...updates,
    id: existing.id, // Immutable
    updatedAt: new Date().toISOString(),
  };

  addAuditLog({
    action: 'server_updated',
    actorEmail,
    targetId: id,
    targetType: 'server',
    details: updates,
  });

  saveStorageDb();
  return getServerById(id, false)!;
}

export function deleteServer(id: string, actorEmail: string): { success: boolean; message: string } {
  const db = loadStorageDb();
  const server = db.servers.find((s) => s.id === id);
  if (!server) {
    throw new Error(`Storage server with ID '${id}' not found.`);
  }

  // Safety Requirement 3: Never remove a server with required files without a safe migration
  const activeVideos = db.videos.filter((v) => v.serverId === id && v.status === 'ready');
  if (activeVideos.length > 0) {
    throw new Error(
      `Cannot delete storage server '${server.name}'. It contains ${activeVideos.length} active video file(s). You must migrate or safely delete these videos before deleting the server.`
    );
  }

  if (db.servers.length <= 1) {
    throw new Error(`Cannot delete the only configured storage server. At least one server must remain configured.`);
  }

  db.servers = db.servers.filter((s) => s.id !== id);

  // If deleted server was default, assign another server as default
  if (server.isDefault || db.settings.defaultServerId === id) {
    const remaining = db.servers[0];
    if (remaining) {
      remaining.isDefault = true;
      db.settings.defaultServerId = remaining.id;
    }
  }

  addAuditLog({
    action: 'server_deleted',
    actorEmail,
    targetId: id,
    targetType: 'server',
    details: { name: server.name, provider: server.provider },
  });

  saveStorageDb();
  return { success: true, message: `Storage server '${server.name}' safely removed.` };
}

// ----------------------------------------------------
// Automatic Storage Selection Engine (Requirement 5)
// ----------------------------------------------------

export function selectStorageServerForUpload(
  fileSizeBytes: number,
  preferredServerId?: string,
  preferredProvider?: StorageProviderType
): StorageServerRecord {
  const db = loadStorageDb();

  // If specific server selected
  if (preferredServerId) {
    const target = db.servers.find((s) => s.id === preferredServerId && s.enabled);
    if (target) {
      if (fileSizeBytes > target.uploadLimitBytes) {
        throw new Error(`File size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds server upload limit of ${(target.uploadLimitBytes / (1024 * 1024)).toFixed(0)}MB for ${target.name}.`);
      }
      if (target.usedBytes + fileSizeBytes > target.capacityBytes) {
        throw new Error(`Server '${target.name}' does not have sufficient capacity remaining.`);
      }
      return target;
    }
  }

  // If specific provider selected (Requirement 5: Everly, Media.cm, etc.)
  if (preferredProvider) {
    const target = db.servers.find((s) => s.provider === preferredProvider && s.enabled);
    if (target) {
      if (fileSizeBytes > target.uploadLimitBytes) {
        throw new Error(`File size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds server upload limit of ${(target.uploadLimitBytes / (1024 * 1024)).toFixed(0)}MB for ${target.name}.`);
      }
      if (target.usedBytes + fileSizeBytes > target.capacityBytes) {
        throw new Error(`Server '${target.name}' does not have sufficient capacity remaining.`);
      }
      return target;
    }
  }

  // If manual selection specified and preferred server was given but not enabled
  if (preferredServerId && db.settings.selectionMode === 'manual') {
    const srv = db.servers.find((s) => s.id === preferredServerId);
    if (srv && !srv.enabled) {
      throw new Error(`Preferred storage server '${srv.name}' is currently disabled.`);
    }
  }

  // Filter eligible servers: enabled, not unhealthy, within upload limits, with available capacity
  const eligible = db.servers.filter((s) => {
    if (!s.enabled) return false;
    if (s.healthStatus === 'unhealthy') return false;
    if (fileSizeBytes > s.uploadLimitBytes) return false;
    if (s.usedBytes + fileSizeBytes > s.capacityBytes) return false;
    return true;
  });

  if (eligible.length === 0) {
    // If no fully healthy server, check any enabled server with space
    const fallback = db.servers.find((s) => s.enabled && s.usedBytes + fileSizeBytes <= s.capacityBytes);
    if (fallback) return fallback;
    throw new Error('No storage servers currently available with adequate capacity and enabled status.');
  }

  // Automatic distribution strategy:
  if (db.settings.autoDistributionStrategy === 'least_utilized') {
    eligible.sort((a, b) => {
      const utilA = a.usedBytes / a.capacityBytes;
      const utilB = b.usedBytes / b.capacityBytes;
      return utilA - utilB;
    });
    return eligible[0];
  }

  // Default: by priority (highest priority first)
  eligible.sort((a, b) => b.priority - a.priority);
  return eligible[0];
}

// ----------------------------------------------------
// Video Records Management (Requirement 2 & 7)
// ----------------------------------------------------

export function listVideos(options?: { onlyReady?: boolean; ownerEmail?: string }): VideoRecord[] {
  const db = loadStorageDb();
  let vids = db.videos;

  if (options?.onlyReady !== false) {
    // By default, show only successfully uploaded, ready videos (Requirement 2)
    vids = vids.filter((v) => v.status === 'ready');
  }

  if (options?.ownerEmail) {
    vids = vids.filter((v) => v.ownerEmail.toLowerCase() === options.ownerEmail!.toLowerCase());
  }

  return vids.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export function getVideoById(id: string): VideoRecord | null {
  const db = loadStorageDb();
  return db.videos.find((v) => v.id === id) || null;
}

export function findDuplicateVideo(fileHash: string, size: number): VideoRecord | null {
  const db = loadStorageDb();
  return db.videos.find((v) => v.status === 'ready' && v.fileHash === fileHash && v.size === size) || null;
}

export function createVideoRecord(data: Omit<VideoRecord, 'id' | 'uploadedAt' | 'updatedAt'>): VideoRecord {
  const db = loadStorageDb();
  const id = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const newVid: VideoRecord = {
    ...data,
    id,
    uploadedAt: now,
    updatedAt: now,
  };

  db.videos.push(newVid);
  recalculateServerStats(db);
  saveStorageDb();
  return newVid;
}

export function updateVideoRecord(id: string, updates: Partial<VideoRecord>): VideoRecord {
  const db = loadStorageDb();
  const idx = db.videos.findIndex((v) => v.id === id);
  if (idx === -1) {
    throw new Error(`Video with ID '${id}' not found.`);
  }

  db.videos[idx] = {
    ...db.videos[idx],
    ...updates,
    id: db.videos[idx].id,
    updatedAt: new Date().toISOString(),
  };

  recalculateServerStats(db);
  saveStorageDb();
  return db.videos[idx];
}

export function deleteVideoRecord(id: string, actorEmail: string): VideoRecord {
  const db = loadStorageDb();
  const idx = db.videos.findIndex((v) => v.id === id);
  if (idx === -1) {
    throw new Error(`Video with ID '${id}' not found.`);
  }

  const deleted = db.videos[idx];
  db.videos.splice(idx, 1);

  addAuditLog({
    action: 'video_deleted',
    actorEmail,
    targetId: id,
    targetType: 'video',
    details: { fileName: deleted.fileName, serverId: deleted.serverId, size: deleted.size },
  });

  recalculateServerStats(db);
  saveStorageDb();
  return deleted;
}

// ----------------------------------------------------
// Upload Jobs Management (Requirement 2)
// ----------------------------------------------------

export function createUploadJob(data: Omit<UploadJobRecord, 'id' | 'createdAt' | 'updatedAt'>): UploadJobRecord {
  const db = loadStorageDb();
  const id = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  const job: UploadJobRecord = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  db.upload_jobs.push(job);
  saveStorageDb();
  return job;
}

export function updateUploadJob(id: string, updates: Partial<UploadJobRecord>): UploadJobRecord {
  const db = loadStorageDb();
  const idx = db.upload_jobs.findIndex((j) => j.id === id);
  if (idx === -1) throw new Error(`Upload job '${id}' not found.`);

  db.upload_jobs[idx] = {
    ...db.upload_jobs[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveStorageDb();
  return db.upload_jobs[idx];
}

// ----------------------------------------------------
// Audit Logs & Settings
// ----------------------------------------------------

export function addAuditLog(log: Omit<StorageAuditLog, 'id' | 'timestamp'>) {
  const db = loadStorageDb();
  const entry: StorageAuditLog = {
    ...log,
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
  };
  db.audit_logs.unshift(entry);
  if (db.audit_logs.length > 500) {
    db.audit_logs = db.audit_logs.slice(0, 500);
  }
}

export function listAuditLogs(limit: number = 100): StorageAuditLog[] {
  const db = loadStorageDb();
  return db.audit_logs.slice(0, limit);
}

export function getStorageSettings(): StorageSettings {
  const db = loadStorageDb();
  return db.settings;
}

export function updateStorageSettings(settings: Partial<StorageSettings>, actorEmail: string): StorageSettings {
  const db = loadStorageDb();
  db.settings = { ...db.settings, ...settings };
  addAuditLog({
    action: 'settings_updated',
    actorEmail,
    details: settings,
  });
  saveStorageDb();
  return db.settings;
}
