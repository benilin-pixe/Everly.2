export type MediaType = 'photo' | 'video' | 'audio' | 'document';

export type UserRole = 'Owner' | 'Shared User' | 'Member';

export interface AuthorizedUser {
  email: string;
  name: string;
  role: UserRole;
  avatarInitials: string;
  avatarColor: string;
  picture?: string;
  accessToken?: string;
  googleSub?: string;
}

export interface MediaFile {
  id: string;
  name: string;
  type: MediaType;
  mimeType: string;
  size: number; // in bytes
  uploadedAt: string; // ISO date string
  uploadedBy: {
    email: string;
    name: string;
  };
  caption?: string;
  driveFileId: string;
  driveFolder: string;
  url: string; // stream URL, object URL, or cached URL
  thumbnailUrl?: string;
  duration?: number; // in seconds (for audio/video)
  artist?: string; // for music
  album?: string; // for music
  isFavorite?: boolean;
  contentData?: string; // for text/markdown preview
  base64Data?: string; // for persistent local video/audio binary storage across sessions
  blobFile?: Blob | File; // native raw binary storage for local files without text conversion
  width?: number;
  height?: number;
  resolution?: string;
}

export type NoteCategory = 'love-note' | 'memory' | 'date-idea' | 'wishlist';
export type NoteColor = 'rose' | 'amber' | 'indigo' | 'emerald';

export interface MemoryNote {
  id: string;
  content: string;
  author: {
    email: string;
    name: string;
    role: UserRole;
    avatarColor: string;
    avatarInitials: string;
  };
  createdAt: string;
  category: NoteCategory;
  isPinned?: boolean;
  colorScheme: NoteColor;
  reactions?: Record<string, number>;
}

export interface StorageStats {
  usedBytes: number;
  totalBytes: number;
  photosBytes: number;
  videosBytes: number;
  audioBytes: number;
  documentsBytes: number;
  itemCount: number;
  driveConnected: boolean;
  driveOwnerEmail: string;
  sharedUserEmail: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  path: string;
}
