/**
 * Audio Metadata Extraction Service
 * Reads actual metadata from user-uploaded audio files (MP3, WAV, M4A, AAC, OGG, WEBM).
 * Extracts authentic ID3 tags (Title, Artist, Album) when present, or cleanly derives
 * the title from the file name and defaults artist to 'Unknown Artist' (no invented text).
 */

export interface ParsedAudioMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  format: string;
  mimeType: string;
  size: number;
}

/**
 * Extracts metadata and exact playback duration from an audio File.
 */
export async function extractAudioFileMetadata(file: File): Promise<ParsedAudioMetadata> {
  // 1. Determine format
  const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
  const cleanBaseTitle = file.name.replace(/\.[^/.]+$/, '').trim();

  let title = cleanBaseTitle;
  let artist = 'Unknown Artist';
  let album: string | undefined = undefined;

  // 2. Try parsing basic ID3v2 tags from buffer if MP3 / Audio
  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const tags = parseId3v2Tags(buffer);
    if (tags.title && tags.title.trim()) {
      title = tags.title.trim();
    }
    if (tags.artist && tags.artist.trim()) {
      artist = tags.artist.trim();
    }
    if (tags.album && tags.album.trim()) {
      album = tags.album.trim();
    }
  } catch (err) {
    // If ID3 parsing fails, fallback safely to clean filename
  }

  // 3. Read exact duration using HTMLAudioElement
  const duration = await getAudioDuration(file);

  return {
    title: title || cleanBaseTitle || 'Untitled Song',
    artist: artist || 'Unknown Artist',
    album: album || undefined,
    duration: Math.round(duration) || 0,
    format: ext,
    mimeType: file.type || 'audio/mpeg',
    size: file.size,
  };
}

/**
 * Measures the exact duration of an audio File using Audio element
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
    };

    const onLoaded = () => {
      const dur = audio.duration;
      cleanUp();
      resolve(isFinite(dur) && dur > 0 ? dur : 0);
    };

    const onError = () => {
      cleanUp();
      resolve(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = objectUrl;

    // Timeout fallback in case metadata never fires
    setTimeout(() => {
      cleanUp();
      resolve(0);
    }, 4000);
  });
}

/**
 * Lightweight ID3v2 header and text frame parser (supports ID3v2.3 and ID3v2.4)
 */
function parseId3v2Tags(buffer: ArrayBuffer): { title?: string; artist?: string; album?: string } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return {};

  // Check ID3 magic bytes "ID3"
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }

  const version = bytes[3]; // e.g. 3 for ID3v2.3, 4 for ID3v2.4
  if (version < 2 || version > 4) return {};

  // Read synchsafe tag size (bytes 6, 7, 8, 9)
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const maxOffset = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;

  const result: { title?: string; artist?: string; album?: string } = {};

  while (offset + 10 < maxOffset) {
    // Read 4-character frame ID
    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    // Read frame size
    let frameSize = 0;
    if (version === 4) {
      // Synchsafe integer
      frameSize =
        ((bytes[offset + 4] & 0x7f) << 21) |
        ((bytes[offset + 5] & 0x7f) << 14) |
        ((bytes[offset + 6] & 0x7f) << 7) |
        (bytes[offset + 7] & 0x7f);
    } else {
      // 32-bit big endian integer
      frameSize =
        (bytes[offset + 4] << 24) |
        (bytes[offset + 5] << 16) |
        (bytes[offset + 6] << 8) |
        bytes[offset + 7];
    }

    if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

    const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);

    // Decode text frames: TIT2 (Title), TPE1 (Artist), TALB (Album)
    if (frameId === 'TIT2') {
      result.title = decodeId3Text(frameData);
    } else if (frameId === 'TPE1') {
      result.artist = decodeId3Text(frameData);
    } else if (frameId === 'TALB') {
      result.album = decodeId3Text(frameData);
    }

    offset += 10 + frameSize;
  }

  return result;
}

/**
 * Decodes text encoding based on ID3 encoding byte (0 = ISO-8859-1, 1 = UTF-16 with BOM, 3 = UTF-8)
 */
function decodeId3Text(bytes: Uint8Array): string {
  if (bytes.length <= 1) return '';
  const encoding = bytes[0];
  const payload = bytes.subarray(1);

  try {
    if (encoding === 0) {
      // ISO-8859-1 / Latin1
      let str = '';
      for (let i = 0; i < payload.length; i++) {
        if (payload[i] === 0) break;
        str += String.fromCharCode(payload[i]);
      }
      return str.trim();
    } else if (encoding === 1 || encoding === 2) {
      // UTF-16
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(payload).replace(/\0/g, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(payload).replace(/\0/g, '').trim();
    }
  } catch {}

  // Fallback string extraction
  return new TextDecoder().decode(payload).replace(/\0/g, '').trim();
}
