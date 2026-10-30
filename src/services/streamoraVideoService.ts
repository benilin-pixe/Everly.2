import { MediaFile } from '../types';

export type StorageProviderType =
  | 's3_compatible'
  | 'cloudflare_r2'
  | 'google_cloud_storage'
  | 'everly_drive'
  | 'media_cm'
  | 'local_disk';

export interface StorageServer {
  id: string;
  name: string;
  provider: StorageProviderType;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  capacityBytes: number;
  usedBytes: number;
  uploadLimitBytes: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'untested';
  healthMessage: string;
  lastCheckedAt: string | null;
  lastSuccessfulUploadAt?: string | null;
  uploadHealth?: 'healthy' | 'degraded' | 'unhealthy';
  playbackHealth?: 'healthy' | 'degraded' | 'unhealthy';
  storedVideoCount: number;
  endpoint?: string;
  accountUrl?: string;
  websiteUrl?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  apiKey?: string;
  publicUrlPrefix?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageSettings {
  selectionMode: 'automatic' | 'manual';
  defaultServerId: string;
  autoDistributionStrategy: 'priority' | 'least_utilized' | 'round_robin';
}

export interface StorageAuditLog {
  id: string;
  action: string;
  actorEmail: string;
  targetId?: string;
  targetType?: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface StreamoraVideoRecord {
  id: string;
  storageKey: string;
  serverId: string;
  provider: string;
  fileName: string;
  fileHash: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  resolution?: string;
  thumbnailUrl?: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  errorMessage?: string | null;
  ownerEmail: string;
  ownerName: string;
  caption?: string;
  isFavorite?: boolean;
  remoteFileId?: string;
  permanentFileRef?: string;
  playbackUrl?: string;
  embedUrl?: string;
  uploadedAt: string;
  updatedAt: string;
}

// Convert StreamoraVideoRecord to standard MediaFile for player/tab compatibility
export function convertVideoRecordToMediaFile(v: StreamoraVideoRecord): MediaFile {
  return {
    id: v.id,
    name: v.fileName,
    type: 'video',
    mimeType: v.mimeType || 'video/mp4',
    size: v.size,
    uploadedAt: v.uploadedAt,
    uploadedBy: {
      email: v.ownerEmail,
      name: v.ownerName,
    },
    caption: v.caption || v.fileName,
    driveFileId: v.serverId,
    driveFolder: `Storage Provider (${v.provider})`,
    url: `/api/storage/videos/${v.id}/stream`,
    thumbnailUrl: v.thumbnailUrl,
    duration: v.duration || 15,
    width: v.width,
    height: v.height,
    resolution: v.resolution,
    isFavorite: v.isFavorite,
  };
}

// ----------------------------------------------------
// Video Operations
// ----------------------------------------------------

export async function fetchPersistentVideos(options?: { userEmail?: string; all?: boolean }): Promise<StreamoraVideoRecord[]> {
  try {
    const params = new URLSearchParams();
    if (options?.all) params.append('all', 'true');
    if (options?.userEmail) params.append('ownerEmail', options.userEmail);

    const res = await fetch(`/api/storage/videos?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.videos || [];
  } catch (err) {
    console.warn('[StreamoraService] Could not fetch persistent videos:', err);
    return [];
  }
}

export async function deletePersistentVideo(id: string, userEmail: string): Promise<boolean> {
  const res = await fetch(`/api/storage/videos/${id}`, {
    method: 'DELETE',
    headers: {
      'x-user-email': userEmail,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete video from storage.');
  }
  return true;
}

export async function updatePersistentVideoMetadata(
  id: string,
  updates: Partial<StreamoraVideoRecord>,
  userEmail: string
): Promise<StreamoraVideoRecord> {
  const res = await fetch(`/api/storage/videos/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': userEmail,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update video metadata.');
  }
  const data = await res.json();
  return data.video;
}

// Upload file with real XMLHttpRequest progress, retry support, and cancellation
export function uploadVideoWithProgress(
  file: File,
  metadata: {
    ownerEmail: string;
    ownerName: string;
    caption?: string;
    duration?: number;
    preferredServerId?: string;
    preferredProvider?: string;
    forceUpload?: boolean;
  },
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void,
  cancelRef?: { abort?: () => void }
): Promise<{ video: StreamoraVideoRecord; server: { id: string; name: string; provider: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (cancelRef) {
      cancelRef.abort = () => {
        xhr.abort();
        reject(new Error('Upload cancelled by user.'));
      };
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent, e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch (err) {
          reject(new Error('Invalid response from storage server.'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during video upload.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled.'));
    });

    const formData = new FormData();
    formData.append('video', file);
    formData.append('ownerEmail', metadata.ownerEmail);
    formData.append('ownerName', metadata.ownerName);
    if (metadata.caption) formData.append('caption', metadata.caption);
    if (metadata.duration) formData.append('duration', String(metadata.duration));
    if (metadata.preferredServerId) formData.append('preferredServerId', metadata.preferredServerId);
    if (metadata.preferredProvider) formData.append('preferredProvider', metadata.preferredProvider);
    if (metadata.forceUpload) formData.append('forceUpload', 'true');

    xhr.open('POST', '/api/storage/upload');
    xhr.setRequestHeader('x-user-email', metadata.ownerEmail);
    xhr.send(formData);
  });
}

// ----------------------------------------------------
// Admin Server Operations
// ----------------------------------------------------

export async function fetchStorageServers(userEmail: string): Promise<StorageServer[]> {
  const res = await fetch('/api/storage/servers', {
    headers: { 'x-user-email': userEmail },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch storage servers.');
  }
  const data = await res.json();
  return data.servers || [];
}

export async function addStorageServer(data: Partial<StorageServer>, userEmail: string): Promise<StorageServer> {
  const res = await fetch('/api/storage/servers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': userEmail,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create storage server.');
  }
  const result = await res.json();
  return result.server;
}

export async function updateStorageServer(
  id: string,
  updates: Partial<StorageServer>,
  userEmail: string
): Promise<StorageServer> {
  const res = await fetch(`/api/storage/servers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': userEmail,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update storage server.');
  }
  const data = await res.json();
  return data.server;
}

export async function deleteStorageServer(id: string, userEmail: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/storage/servers/${id}`, {
    method: 'DELETE',
    headers: { 'x-user-email': userEmail },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to remove storage server.');
  }
  return await res.json();
}

export async function testStorageServerConnection(
  id: string,
  userEmail: string
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const res = await fetch(`/api/storage/servers/${id}/test`, {
    method: 'POST',
    headers: { 'x-user-email': userEmail },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to test server connectivity.');
  }
  const data = await res.json();
  return data.result;
}

export async function migrateStorageServerVideos(
  sourceServerId: string,
  targetServerId: string,
  userEmail: string
): Promise<{ success: boolean; message: string; migratedCount: number }> {
  const res = await fetch('/api/storage/servers/migrate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': userEmail,
    },
    body: JSON.stringify({ sourceServerId, targetServerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to migrate storage server videos.');
  }
  return await res.json();
}

export async function fetchStorageSettings(userEmail: string): Promise<StorageSettings> {
  const res = await fetch('/api/storage/settings', {
    headers: { 'x-user-email': userEmail },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch storage settings.');
  }
  const data = await res.json();
  return data.settings;
}

export async function updateStorageSettings(settings: Partial<StorageSettings>, userEmail: string): Promise<StorageSettings> {
  const res = await fetch('/api/storage/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': userEmail,
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update storage settings.');
  }
  const data = await res.json();
  return data.settings;
}

export async function fetchAuditLogs(userEmail: string, limit: number = 100): Promise<StorageAuditLog[]> {
  const res = await fetch(`/api/storage/audit-logs?limit=${limit}`, {
    headers: { 'x-user-email': userEmail },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
}
