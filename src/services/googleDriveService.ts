/**
 * Google Drive API v3 Service Layer for Everly
 * Handles dedicated shared folder management (Everly Shared Storage),
 * organized subfolders (Photos, Videos, Music, Backgrounds, Memories, Other),
 * multipart file uploading, media streaming, and quota reporting with resilient error classification and retry logic.
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  parents?: string[];
  description?: string;
}

export interface DriveFolderMap {
  rootId: string;
  photosId: string;
  videosId: string;
  musicId: string;
  backgroundsId: string;
  memoriesId: string;
  otherId: string;
}

const ROOT_FOLDER_NAME = 'Everly Shared Storage';
const SUBFOLDERS = ['Photos', 'Videos', 'Music', 'Backgrounds', 'Memories', 'Other'] as const;
export type EverlySubfolder = typeof SUBFOLDERS[number];

/**
 * Executes an authenticated Google Drive API request with error classification and exponential backoff retry for transient errors.
 */
async function driveFetch(endpoint: string, accessToken: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.ok) {
      return response;
    }

    if (response.status === 401) {
      const authErr = new Error('Google Drive authorization token has expired. Please sign in again.');
      (authErr as any).isAuthExpired = true;
      (authErr as any).status = 401;
      throw authErr;
    }

    if (response.status === 403) {
      const forbiddenErr = new Error('Google Drive API Error (403 Forbidden): Insufficient permissions or storage quota exceeded.');
      (forbiddenErr as any).status = 403;
      throw forbiddenErr;
    }

    // Transient errors (429 Rate Limit, 5xx Server Error)
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return driveFetch(endpoint, accessToken, options, retries - 1, delay * 2);
    }

    const errText = await response.text();
    let parsedMessage = errText;
    try {
      const errJson = JSON.parse(errText);
      parsedMessage = errJson.error?.message || errText;
    } catch {}
    const apiErr = new Error(`Google Drive API Error (${response.status}): ${parsedMessage}`);
    (apiErr as any).status = response.status;
    throw apiErr;
  } catch (networkErr: any) {
    if (networkErr?.status === 401 || networkErr?.status === 403) {
      throw networkErr;
    }
    if (retries > 0 && (networkErr.name === 'TypeError' || networkErr.message?.includes('network'))) {
      await new Promise((r) => setTimeout(r, delay));
      return driveFetch(endpoint, accessToken, options, retries - 1, delay * 2);
    }
    throw networkErr;
  }
}

/**
 * Searches for a folder by name inside a parent folder (or root)
 */
export async function findFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string | null> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${folderName.replace(/'/g, "\\'")}'`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;
  const res = await driveFetch(url, accessToken);
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Creates a new folder inside Google Drive
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    body.parents = [parentId];
  }

  const res = await driveFetch('https://www.googleapis.com/drive/v3/files', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.id;
}

/**
 * Initializes and retrieves the "Everly Shared Storage" folder structure.
 */
export async function initializeEverlyStorage(accessToken: string): Promise<DriveFolderMap> {
  // 1. Locate or create Root Folder
  let rootId = await findFolder(accessToken, ROOT_FOLDER_NAME);
  if (!rootId) {
    rootId = await createFolder(accessToken, ROOT_FOLDER_NAME);
  }

  // 2. Locate or create Subfolders
  const folderMap: Partial<DriveFolderMap> = { rootId };

  for (const subfolder of SUBFOLDERS) {
    let subId = await findFolder(accessToken, subfolder, rootId);
    if (!subId) {
      subId = await createFolder(accessToken, subfolder, rootId);
    }
    const key = `${subfolder.toLowerCase()}Id` as keyof DriveFolderMap;
    folderMap[key] = subId;
  }

  return folderMap as DriveFolderMap;
}

/**
 * Uploads a file to Google Drive using standard Multipart Upload
 */
export async function uploadFileToDrive(
  accessToken: string,
  file: File | Blob,
  fileName: string,
  targetFolder: EverlySubfolder,
  folderMap?: DriveFolderMap | null,
  caption?: string
): Promise<GoogleDriveFile> {
  let parentId: string | undefined;

  if (folderMap) {
    const key = `${targetFolder.toLowerCase()}Id` as keyof DriveFolderMap;
    parentId = folderMap[key] || folderMap.rootId;
  } else {
    // Attempt to locate target subfolder dynamically
    const rootId = await findFolder(accessToken, ROOT_FOLDER_NAME);
    if (rootId) {
      parentId = (await findFolder(accessToken, targetFolder, rootId)) ?? undefined;
      if (!parentId) {
        parentId = (await createFolder(accessToken, targetFolder, rootId)) ?? undefined;
      }
    } else {
      const newRootId = await createFolder(accessToken, ROOT_FOLDER_NAME);
      parentId = (newRootId ? await createFolder(accessToken, targetFolder, newRootId) : null) ?? undefined;
    }
  }

  const metadata: any = {
    name: fileName,
    parents: parentId ? [parentId] : undefined,
  };

  if (caption) {
    metadata.description = caption;
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webContentLink,webViewLink,parents,description',
    accessToken,
    {
      method: 'POST',
      body: form,
    }
  );

  return await res.json();
}

/**
 * Deletes a file from Google Drive
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, accessToken, {
    method: 'DELETE',
  });
}

/**
 * Renames or updates metadata of a file in Google Drive
 */
export async function renameDriveFile(accessToken: string, fileId: string, newName: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, accessToken, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
}

/**
 * Lists all files in the Everly shared storage folder hierarchy
 */
export async function listDriveFiles(accessToken: string): Promise<GoogleDriveFile[]> {
  const rootId = await findFolder(accessToken, ROOT_FOLDER_NAME);
  if (!rootId) {
    return [];
  }

  // Get all subfolder IDs
  const subIds: string[] = [rootId];
  for (const subfolder of SUBFOLDERS) {
    const subId = await findFolder(accessToken, subfolder, rootId);
    if (subId) subIds.push(subId);
  }

  // Query files whose parents are any of the Everly folders
  const parentQuery = subIds.map((id) => `'${id}' in parents`).join(' or ');
  const query = `(${parentQuery}) and trashed = false`;

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webContentLink,webViewLink,parents,description)&pageSize=1000&spaces=drive`;
  const res = await driveFetch(url, accessToken);
  const data = await res.json();

  return data.files || [];
}

/**
 * Gets storage quota usage for Drive account
 */
export async function getDriveStorageQuota(accessToken: string): Promise<{ usedBytes: number; totalBytes: number }> {
  try {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', accessToken);
    const data = await res.json();
    const quota = data.storageQuota;
    if (quota) {
      return {
        usedBytes: Number(quota.usageInDrive) || Number(quota.usage) || 0,
        totalBytes: Number(quota.limit) || (15 * 1024 * 1024 * 1024),
      };
    }
  } catch {}
  return { usedBytes: 0, totalBytes: 15 * 1024 * 1024 * 1024 };
}
