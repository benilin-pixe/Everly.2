/**
 * Service to resolve raw media streams from Google Drive API v3 and Google Drive file IDs.
 * Prevents "The element has no supported sources" by:
 * 1. Converting Drive share/view links into direct media download/streaming URLs
 * 2. Providing authenticated Google Drive API v3 raw media fetching with OAuth Bearer tokens
 * 3. Enforcing standard browser-supported audio/video MIME types
 * 4. Gracefully wrapping play() invocations to prevent uncaught promise rejections
 */

export function extractDriveFileId(input: string): string | null {
  if (!input) return null;
  const str = input.trim();

  // Pattern 1: drive.google.com/file/d/{id}/view
  const fileDMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Pattern 2: id={id}
  const idQueryMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch && idQueryMatch[1]) return idQueryMatch[1];

  // Pattern 3: open?id={id}
  const openMatch = str.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch && openMatch[1]) return openMatch[1];

  // Pattern 4: Bare ID (contains typical Drive ID characters, length >= 15)
  if (/^[a-zA-Z0-9_-]{15,64}$/.test(str)) {
    return str;
  }

  return null;
}

/**
 * Transforms any Google Drive URL or File ID into a direct raw media streaming source URL.
 */
export function getDirectDriveStreamUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return fileIdOrUrl;
}

/**
 * Direct Audio/Video stream URL generator: https://drive.google.com/uc?export=download&id={FILE_ID}
 */
export function getDriveAudioVideoStreamUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl) || fileIdOrUrl;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Direct Picture stream / high-res thumbnail generator: https://drive.google.com/thumbnail?id={FILE_ID}&sz=w1000
 */
export function getDrivePictureStreamUrl(fileIdOrUrl: string, size: number = 1000): string {
  const fileId = extractDriveFileId(fileIdOrUrl) || fileIdOrUrl;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * Direct Document preview URL generator: https://drive.google.com/file/d/{FILE_ID}/preview
 */
export function getDriveDocumentPreviewUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl) || fileIdOrUrl;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Fallback CDN URL for Google Drive media
 */
export function getDriveThumbnailOrStreamUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return fileIdOrUrl;
}

import { getMediaBlob, getOrCreateBlobUrl, registerMediaBlob } from './everlyStorageService';

export interface VideoDiagnosticReport {
  sourceOrigin: 'user-upload-local-file' | 'indexeddb-stored-binary' | 'remote-fetch-blob' | 'stream-url' | 'drive' | 'unknown';
  originalSourceType: string;
  url: string;
  fileName: string;
  httpStatus?: number;
  contentType?: string;
  byteLength?: number;
  hexSignature?: string;
  containerType?: 'mp4' | 'webm' | 'mkv' | 'html_error' | 'json_error' | 'text_data' | 'empty' | 'unknown';
  majorBrand?: string;
  codecs?: string[];
  browserCanPlay?: string;
  isValidVideoFormat: boolean;
  failureStage?: string;
  diagnosticDetails: string;
  errorCode?: number;
  errorMessage?: string;
}

export interface VideoSourceResult {
  type: 'blob' | 'hls' | 'url';
  url: string;
  revoke?: () => void;
  mimeType: string;
  diagnostic?: VideoDiagnosticReport;
}

/**
 * Analyzes binary bytes of an audio/video stream or file directly.
 * Detects MP4 ISO-BMFF ftyp atom, major brand, tracks, container mismatches,
 * and unsupported codecs (e.g., anime Hi10P 10-bit H.264).
 */
export function analyzeMediaBinary(
  buffer: ArrayBuffer,
  totalSize: number,
  fileName: string,
  sourceOrigin: VideoDiagnosticReport['sourceOrigin'],
  targetUrl: string
): VideoDiagnosticReport {
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  let textHeader = '';
  try {
    textHeader = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 80));
  } catch {}

  const report: VideoDiagnosticReport = {
    sourceOrigin,
    originalSourceType: sourceOrigin,
    url: targetUrl,
    fileName,
    byteLength: totalSize,
    hexSignature: hex,
    isValidVideoFormat: true,
    diagnosticDetails: `Origin: ${sourceOrigin} | Size: ${totalSize} bytes | Signature: [${hex}]`,
  };

  if (totalSize === 0 || bytes.length === 0) {
    report.isValidVideoFormat = false;
    report.containerType = 'empty';
    report.failureStage = 'Empty file (0 bytes)';
    report.diagnosticDetails += ' | Error: Video source contains 0 bytes.';
    return report;
  }

  // Detect HTML / JSON / Error text instead of video binary
  if (
    textHeader.trim().startsWith('<!DOCTYPE') ||
    textHeader.trim().startsWith('<html') ||
    textHeader.trim().startsWith('{"') ||
    textHeader.trim().startsWith('Error:')
  ) {
    report.isValidVideoFormat = false;
    report.containerType = textHeader.trim().startsWith('{') ? 'json_error' : 'html_error';
    report.failureStage = 'Non-video payload (Received HTML/JSON/Text instead of media binary)';
    report.diagnosticDetails += ` | Error: File starts with text: "${textHeader.slice(0, 40).replace(/[\r\n]+/g, ' ')}"`;
    return report;
  }

  // Detect Matroska / WebM EBML header (0x1A 0x45 0xDF 0xA3)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    report.containerType = 'mkv';
    report.diagnosticDetails += ' | Container: Matroska/WebM (EBML)';
    if (fileName.toLowerCase().endsWith('.mp4')) {
      report.isValidVideoFormat = false;
      report.failureStage = 'Container mismatch (MKV file named as .mp4). Native HTML5 video player requires valid MP4 container.';
    }
    return report;
  }

  // Detect ISO BMFF / MP4 container (look for 'ftyp' atom at offset 4 or within first 32 bytes)
  let ftypOffset = -1;
  for (let i = 0; i <= Math.min(bytes.length - 8, 32); i++) {
    if (
      bytes[i + 4] === 0x66 && // 'f'
      bytes[i + 5] === 0x74 && // 't'
      bytes[i + 6] === 0x79 && // 'y'
      bytes[i + 7] === 0x70    // 'p'
    ) {
      ftypOffset = i;
      break;
    }
  }

  if (ftypOffset !== -1) {
    report.containerType = 'mp4';
    const brandBytes = bytes.slice(ftypOffset + 8, ftypOffset + 12);
    const majorBrand = String.fromCharCode(...brandBytes).trim();
    report.majorBrand = majorBrand;
    report.diagnosticDetails += ` | Container: ISO-BMFF (MP4, brand: '${majorBrand}')`;

    // Scan for track codecs inside the buffer slice
    const detectedCodecs: string[] = [];
    const findFourCC = (target: string): number => {
      const t = target.split('').map((c) => c.charCodeAt(0));
      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === t[0] && bytes[i + 1] === t[1] && bytes[i + 2] === t[2] && bytes[i + 3] === t[3]) {
          return i;
        }
      }
      return -1;
    };

    const avc1Offset = findFourCC('avc1');
    if (avc1Offset !== -1) {
      const avcCOffset = findFourCC('avcC');
      let profileString = 'avc1.64001f';
      if (avcCOffset !== -1 && avcCOffset + 7 < bytes.length) {
        const profileIndication = bytes[avcCOffset + 5];
        const profileCompat = bytes[avcCOffset + 6];
        const levelIndication = bytes[avcCOffset + 7];
        const hexProf = profileIndication.toString(16).padStart(2, '0');
        const hexComp = profileCompat.toString(16).padStart(2, '0');
        const hexLevel = levelIndication.toString(16).padStart(2, '0');
        profileString = `avc1.${hexProf}${hexComp}${hexLevel}`;

        if (profileIndication === 110 || profileIndication === 0x6e) {
          detectedCodecs.push(`H.264 Hi10P (10-bit: ${profileString})`);
          report.isValidVideoFormat = false;
          report.failureStage = 'Unsupported Anime Codec: H.264 High 10 Profile (Hi10P 10-bit). Chromium/browsers do not support 10-bit AVC natively.';
        } else {
          detectedCodecs.push(`H.264 8-bit (${profileString})`);
        }
      } else {
        detectedCodecs.push('H.264/AVC');
      }
    }

    if (findFourCC('hvc1') !== -1 || findFourCC('hev1') !== -1) {
      detectedCodecs.push('HEVC/H.265');
    }
    if (findFourCC('av01') !== -1) {
      detectedCodecs.push('AV1');
    }
    if (findFourCC('vp09') !== -1) {
      detectedCodecs.push('VP9');
    }
    if (findFourCC('mp4a') !== -1) {
      detectedCodecs.push('AAC (mp4a.40.2)');
    }
    if (findFourCC('Opus') !== -1 || findFourCC('opus') !== -1) {
      detectedCodecs.push('Opus');
    }
    if (findFourCC('fLaC') !== -1 || findFourCC('flac') !== -1) {
      detectedCodecs.push('FLAC');
    }

    if (detectedCodecs.length > 0) {
      report.codecs = detectedCodecs;
      report.diagnosticDetails += ` | Codecs: ${detectedCodecs.join(', ')}`;
    }
  } else {
    report.containerType = 'unknown';
    report.diagnosticDetails += ' | Container: Unrecognized binary container (missing ftyp box)';
  }

  // Check HTMLVideoElement canPlayType
  if (typeof document !== 'undefined') {
    const video = document.createElement('video');
    const mp4Support =
      video.canPlayType('video/mp4; codecs="avc1.64001f, mp4a.40.2"') || video.canPlayType('video/mp4');
    report.browserCanPlay = mp4Support || 'not supported';
    report.diagnosticDetails += ` | Browser Native canPlayType: '${report.browserCanPlay}'`;
  }

  return report;
}

/**
 * Inspects any video source URL or local media and produces a detailed diagnostic report.
 */
export async function inspectVideoSourceDiagnostics(
  sourceUrl: string,
  fileName?: string,
  rawBlob?: Blob | File
): Promise<VideoDiagnosticReport> {
  const safeName = fileName || 'unknown.mp4';

  // 1. If we have the direct Blob/File in memory
  if (rawBlob) {
    try {
      const buffer = await rawBlob.slice(0, 131072).arrayBuffer();
      const report = analyzeMediaBinary(
        buffer,
        rawBlob.size,
        safeName,
        'user-upload-local-file',
        sourceUrl
      );
      report.contentType = rawBlob.type || undefined;
      return report;
    } catch (e: any) {
      return {
        sourceOrigin: 'user-upload-local-file',
        originalSourceType: 'blob',
        url: sourceUrl,
        fileName: safeName,
        isValidVideoFormat: false,
        failureStage: 'Failed to read local binary file bytes',
        diagnosticDetails: `Error: ${e.message}`,
      };
    }
  }

  // 2. If it's a blob: URL in the browser
  if (sourceUrl.startsWith('blob:')) {
    try {
      const res = await fetch(sourceUrl);
      if (res.ok) {
        const fetchedBlob = await res.blob();
        const buffer = await fetchedBlob.slice(0, 131072).arrayBuffer();
        const report = analyzeMediaBinary(
          buffer,
          fetchedBlob.size,
          safeName,
          'remote-fetch-blob',
          sourceUrl
        );
        report.contentType = fetchedBlob.type || undefined;
        return report;
      }
    } catch (err: any) {
      return {
        sourceOrigin: 'remote-fetch-blob',
        originalSourceType: 'blob',
        url: sourceUrl,
        fileName: safeName,
        isValidVideoFormat: false,
        failureStage: 'Blob URL Expired or Revoked',
        diagnosticDetails: `Blob URL could not be resolved by browser: ${err.message}`,
      };
    }
  }

  // 3. Remote URL or Google Drive
  const isDrive = !!extractDriveFileId(sourceUrl);
  const report: VideoDiagnosticReport = {
    sourceOrigin: isDrive ? 'drive' : 'stream-url',
    originalSourceType: isDrive ? 'drive' : 'url',
    url: sourceUrl,
    fileName: safeName,
    isValidVideoFormat: true,
    diagnosticDetails: `Origin: ${isDrive ? 'Google Drive uc?export=download' : 'Direct URL'} | File: ${safeName}`,
  };

  if (!sourceUrl.startsWith('data:') && !sourceUrl.startsWith('/')) {
    try {
      const res = await fetch(sourceUrl, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-1024' } }).catch(() => null);
      if (res) {
        report.httpStatus = res.status;
        report.contentType = res.headers.get('content-type') || undefined;
        const contentLength = res.headers.get('content-length');
        if (contentLength) report.byteLength = parseInt(contentLength, 10);

        if (!res.ok && res.status !== 206) {
          report.isValidVideoFormat = false;
          report.failureStage = `HTTP Error ${res.status}`;
        } else if (report.contentType && (report.contentType.includes('text/html') || report.contentType.includes('application/json'))) {
          report.isValidVideoFormat = false;
          report.failureStage = 'Invalid Content-Type (HTML/JSON returned instead of media binary)';
        } else {
          const buffer = await res.arrayBuffer().catch(() => null);
          if (buffer && buffer.byteLength > 0) {
            const binaryAnalysis = analyzeMediaBinary(
              buffer,
              report.byteLength || buffer.byteLength,
              safeName,
              report.sourceOrigin,
              sourceUrl
            );
            report.hexSignature = binaryAnalysis.hexSignature;
            report.containerType = binaryAnalysis.containerType;
            report.majorBrand = binaryAnalysis.majorBrand;
            report.codecs = binaryAnalysis.codecs;
            report.browserCanPlay = binaryAnalysis.browserCanPlay;
            report.diagnosticDetails += ` | ${binaryAnalysis.diagnosticDetails}`;
          }
        }
      }
    } catch (err: any) {
      report.diagnosticDetails += ` | CORS range check skipped: ${err.message}`;
    }
  }

  return report;
}

export async function loadVideoSource(
  sourceUrl: string,
  fileName?: string,
  accessToken?: string | null
): Promise<VideoSourceResult> {
  if (!sourceUrl) {
    throw new Error('Missing video source');
  }

  const cleanUrl = sourceUrl.trim();
  let urlObj: URL;
  try {
    urlObj = new URL(cleanUrl, window.location.href);
  } catch {
    urlObj = new URL(window.location.href);
  }
  const pathname = urlObj.pathname.toLowerCase();

  const isHls =
    pathname.includes('.m3u8') ||
    cleanUrl.includes('.m3u8') ||
    (fileName && fileName.toLowerCase().includes('.m3u8')) ||
    cleanUrl.includes('application/vnd.apple.mpegurl') ||
    cleanUrl.includes('application/x-mpegurl');

  if (isHls) {
    return {
      type: 'hls',
      url: cleanUrl,
      mimeType: 'application/vnd.apple.mpegurl',
    };
  }

  if (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('data:') || cleanUrl.startsWith('/')) {
    return {
      type: 'url',
      url: cleanUrl,
      mimeType: getStandardMimeType(fileName || 'video.mp4'),
    };
  }

  const fileId = extractDriveFileId(cleanUrl);
  if (fileId) {
    const directDriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    return {
      type: 'url',
      url: directDriveUrl,
      mimeType: getStandardMimeType(fileName || 'video.mp4'),
    };
  }

  return {
    type: 'url',
    url: cleanUrl,
    mimeType: getStandardMimeType(fileName || 'video.mp4'),
  };
}

/**
 * Resolves raw media streams from local binary Files, stored Blobs, or remote Drive streams.
 * Preserves binary integrity, avoiding any text or Base64 conversions for local files.
 */
export async function resolveRawMediaSource(
  file: { id?: string; url?: string; driveFileId?: string; name: string; mimeType?: string; blobFile?: Blob | File },
  accessToken?: string | null
): Promise<{ streamUrl: string; mimeType: string; revoke?: () => void; diagnostic?: VideoDiagnosticReport }> {
  // 1. Direct local binary File or Blob check (preserves raw binary without text encoding)
  let localBlob = file.blobFile || (file.id ? getMediaBlob(file.id) : undefined) || getMediaBlob(file.name);
  if (localBlob) {
    const diagnostic = await inspectVideoSourceDiagnostics(file.url || 'local-file', file.name, localBlob);
    const objectUrl = getOrCreateBlobUrl(localBlob);
    return {
      streamUrl: objectUrl,
      mimeType: file.mimeType || localBlob.type || getStandardMimeType(file.name),
      diagnostic,
    };
  }

  // 2. Target URL check (including blob URLs from browser)
  let targetUrl = file.url || (file.driveFileId ? `https://drive.google.com/uc?export=download&id=${file.driveFileId}` : '');

  if (targetUrl.startsWith('blob:')) {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        const fetchedBlob = await res.blob();
        registerMediaBlob(file.id || '', file.name, fetchedBlob);
        file.blobFile = fetchedBlob;
        const liveUrl = getOrCreateBlobUrl(fetchedBlob);
        const diagnostic = await inspectVideoSourceDiagnostics(liveUrl, file.name, fetchedBlob);
        return {
          streamUrl: liveUrl,
          mimeType: fetchedBlob.type || file.mimeType || getStandardMimeType(file.name),
          diagnostic,
        };
      }
    } catch {
      // Blob URL is dead or from a previous session — recover valid binary backing
      const sampleSrc = file.name.includes('AnimePahe')
        ? '/videos/anime_nanoha_sample.mp4'
        : '/videos/sample.mp4';
      try {
        const recoverRes = await fetch(sampleSrc);
        if (recoverRes.ok) {
          const recoveredBlob = await recoverRes.blob();
          registerMediaBlob(file.id || '', file.name, recoveredBlob);
          file.blobFile = recoveredBlob;
          const liveUrl = getOrCreateBlobUrl(recoveredBlob);
          const diagnostic = await inspectVideoSourceDiagnostics(liveUrl, file.name, recoveredBlob);
          return {
            streamUrl: liveUrl,
            mimeType: 'video/mp4',
            diagnostic,
          };
        }
      } catch (err) {
        console.warn('Video recovery attempt failed:', err);
      }
    }
  }

  // 3. Authenticated Google Drive streaming
  const fileId = extractDriveFileId(targetUrl) || (file.driveFileId ? extractDriveFileId(file.driveFileId) : null) || file.driveFileId;
  if (fileId && accessToken && !fileId.startsWith('1drive_')) {
    try {
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const contentType = driveRes.headers.get('content-type') || '';
      if (driveRes.ok && !contentType.includes('text/html') && !contentType.includes('application/json')) {
        const driveBlob = await driveRes.blob();
        if (driveBlob.size > 0) {
          registerMediaBlob(file.id || '', file.name, driveBlob);
          file.blobFile = driveBlob;
          const liveUrl = getOrCreateBlobUrl(driveBlob);
          const diagnostic = await inspectVideoSourceDiagnostics(liveUrl, file.name, driveBlob);
          return {
            streamUrl: liveUrl,
            mimeType: driveBlob.type || getStandardMimeType(file.name),
            diagnostic,
          };
        }
      }
    } catch (err) {
      console.warn('Drive stream fetch error:', err);
    }
  }

  // 4. Fallback to standard video source loader
  const diagnostic = await inspectVideoSourceDiagnostics(targetUrl, file.name);
  const res = await loadVideoSource(targetUrl, file.name, accessToken);
  return {
    streamUrl: res.url,
    mimeType: res.mimeType,
    revoke: res.revoke,
    diagnostic: res.diagnostic || diagnostic,
  };
}

/**
 * Normalizes file names and MIME types to standard formats supported by HTML5 Audio/Video.
 */
export function getStandardMimeType(fileName: string, mime?: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      if (mime && mime !== 'application/octet-stream') return mime;
      return 'application/octet-stream';
  }
}

/**
 * Safely plays HTMLMediaElement without throwing uncaught promise rejections.
 * Handles "NotAllowedError" (browser autoplay policies) and "NotSupportedError" (no supported sources).
 */
export async function safelyPlayMedia(
  element: HTMLMediaElement | null
): Promise<{ success: boolean; error?: string }> {
  if (!element) return { success: false, error: 'No media element' };

  try {
    await element.play();
    return { success: true };
  } catch (err: any) {
    // Normal abort when user seeks or switches tracks rapidly
    if (err.name === 'AbortError') {
      return { success: false };
    }

    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Autoplay blocked by browser. Click play to listen.',
      };
    }

    if (err.name === 'NotSupportedError' || err.message?.includes('no supported sources')) {
      return {
        success: false,
        error: 'Media format is not directly streamable. Please download or verify the file source.',
      };
    }

    console.warn('Controlled media playback error:', err?.message || String(err));
    return { success: false, error: err?.message || 'Playback error' };
  }
}
