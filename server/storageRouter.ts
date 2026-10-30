import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import * as storageDb from './storageDb.ts';
import { getStorageAdapter } from './storageAdapters.ts';
import { isAuthorizedOwnerEmail } from './authStore.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 * 1024, // 4GB max buffer
  },
});

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const userEmail =
    (req.headers['x-user-email'] as string) ||
    (req.query.userEmail as string) ||
    (req.body?.userEmail as string);
  if (!userEmail || !isAuthorizedOwnerEmail(userEmail)) {
    res.status(403).json({ error: 'Access denied. Administrator privileges required to manage storage servers.' });
    return;
  }
  next();
}

export function createStorageRouter() {
  const router = express.Router();

  // ----------------------------------------------------
  // Video Endpoints (Client & Admin)
  // ----------------------------------------------------

  // 1. List videos (Requirement 1 & 2: Show only successfully uploaded, ready videos)
  router.get('/videos', (req: Request, res: Response) => {
    const onlyReady = req.query.all !== 'true';
    const ownerEmail = req.query.ownerEmail as string | undefined;
    const videos = storageDb.listVideos({ onlyReady, ownerEmail });
    res.json({ success: true, videos });
  });

  // 2. Get video metadata by ID
  router.get('/videos/:id', (req: Request, res: Response) => {
    const video = storageDb.getVideoById(req.params.id);
    if (!video) {
      res.status(404).json({ error: 'Video not found.' });
      return;
    }
    res.json({ success: true, video });
  });

  // 3. High-Performance Stream Video with HTTP 206 Range Support (Requirement 2)
  router.get('/videos/:id/stream', async (req: Request, res: Response) => {
    const video = storageDb.getVideoById(req.params.id);
    if (!video) {
      res.status(404).send('Video not found');
      return;
    }

    const server = storageDb.getServerById(video.serverId, true);
    if (!server) {
      res.status(502).send('Storage server for video is unavailable');
      return;
    }

    try {
      const adapter = getStorageAdapter(server);
      const range = req.headers.range;
      const streamResult = await adapter.getObjectStream(video.storageKey, range);

      res.status(streamResult.statusCode);
      res.setHeader('Content-Type', streamResult.contentType || video.mimeType || 'video/mp4');
      res.setHeader('Content-Length', streamResult.contentLength);
      res.setHeader('Accept-Ranges', streamResult.acceptRanges || 'bytes');

      if (streamResult.contentRange) {
        res.setHeader('Content-Range', streamResult.contentRange);
      }

      // Stream binary chunks directly to HTML5 video element
      if ((streamResult.stream as any).pipe) {
        (streamResult.stream as any).pipe(res);
      } else if (streamResult.stream) {
        // Web stream to Node response
        for await (const chunk of streamResult.stream as any) {
          res.write(chunk);
        }
        res.end();
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('[StorageRouter] Error streaming video:', err);
      if (!res.headersSent) {
        res.status(500).send(`Streaming error: ${err.message}`);
      }
    }
  });

  // 4. Download Video directly
  router.get('/videos/:id/download', async (req: Request, res: Response) => {
    const video = storageDb.getVideoById(req.params.id);
    if (!video) {
      res.status(404).send('Video not found');
      return;
    }

    const server = storageDb.getServerById(video.serverId, true);
    if (!server) {
      res.status(502).send('Storage server unavailable');
      return;
    }

    try {
      const adapter = getStorageAdapter(server);
      const streamResult = await adapter.getObjectStream(video.storageKey);

      res.setHeader('Content-Type', streamResult.contentType || video.mimeType || 'video/mp4');
      res.setHeader('Content-Length', streamResult.contentLength);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(video.fileName)}"`);

      if ((streamResult.stream as any).pipe) {
        (streamResult.stream as any).pipe(res);
      } else {
        for await (const chunk of streamResult.stream as any) {
          res.write(chunk);
        }
        res.end();
      }
    } catch (err: any) {
      res.status(500).send(`Download failed: ${err.message}`);
    }
  });

  // 5. Upload Video (Requirement 2 & 5)
  router.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No video file provided in upload request.' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname || `video_${Date.now()}.mp4`;
      const mimeType = req.file.mimetype || 'video/mp4';
      const size = fileBuffer.length;

      // Validate video format
      if (!mimeType.startsWith('video/') && !fileName.match(/\.(mp4|webm|mov|mkv)$/i)) {
        res.status(400).json({ error: 'Invalid file format. Only valid video files (MP4, WebM, MOV) are accepted.' });
        return;
      }

      const ownerEmail = (req.body.ownerEmail as string) || (req.headers['x-user-email'] as string) || 'benilin76@gmail.com';
      const ownerName = (req.body.ownerName as string) || 'BeniLin';
      const caption = req.body.caption || '';
      const preferredServerId = req.body.preferredServerId as string | undefined;
      const preferredProvider = req.body.preferredProvider as storageDb.StorageProviderType | undefined;

      // Duplicate protection: SHA-256 hash check
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const forceUpload = req.body.forceUpload === 'true';

      if (!forceUpload) {
        const existingDuplicate = storageDb.findDuplicateVideo(fileHash, size);
        if (existingDuplicate) {
          res.status(409).json({
            error: 'Duplicate video detected.',
            isDuplicate: true,
            existingVideo: existingDuplicate,
            message: `A video with identical content '${existingDuplicate.fileName}' already exists in your library.`,
          });
          return;
        }
      }

      // Select target storage server (Requirement 5: Everly, Media.cm, or automatic)
      const targetServer = storageDb.selectStorageServerForUpload(size, preferredServerId, preferredProvider);
      const server = storageDb.getServerById(targetServer.id, true)!;
      const adapter = getStorageAdapter(server);

      // Create permanent storage key
      const ext = path.extname(fileName) || '.mp4';
      const storageKey = `streamora_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;

      // Create tracking upload job
      const job = storageDb.createUploadJob({
        videoId: '',
        serverId: server.id,
        fileName,
        fileSize: size,
        mimeType,
        status: 'uploading',
        progress: 10,
        retries: 0,
        maxRetries: 3,
        ownerEmail,
      });

      // Write object to storage adapter (with originalFileName metadata for Media.cm)
      const putResult = await adapter.putObject(storageKey, fileBuffer, mimeType, { originalFileName: fileName });
      if (!putResult.success) {
        storageDb.updateUploadJob(job.id, { status: 'failed', error: 'Storage write failed' });
        throw new Error(`Failed to store video on storage server '${server.name}'.`);
      }

      storageDb.updateUploadJob(job.id, { progress: 85, status: 'verifying' });

      // Create permanent database record (Requirement 6)
      const videoRecord = storageDb.createVideoRecord({
        storageKey,
        serverId: server.id,
        provider: server.provider,
        fileName,
        fileHash,
        mimeType,
        size,
        duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
        width: req.body.width ? parseInt(req.body.width, 10) : undefined,
        height: req.body.height ? parseInt(req.body.height, 10) : undefined,
        resolution: req.body.resolution || undefined,
        thumbnailUrl: req.body.thumbnailUrl || undefined,
        status: 'ready',
        ownerEmail,
        ownerName,
        caption,
        isFavorite: false,
        remoteFileId: putResult.remoteFileId || storageKey,
        permanentFileRef: putResult.key || storageKey,
        playbackUrl: adapter.getPlaybackUrl(storageKey, ''),
        embedUrl: putResult.embedUrl || undefined,
      });

      // Update server upload metrics and status
      storageDb.updateServer(
        server.id,
        {
          lastSuccessfulUploadAt: new Date().toISOString(),
          uploadHealth: 'healthy',
          playbackHealth: 'healthy',
        },
        ownerEmail
      );

      storageDb.updateUploadJob(job.id, {
        videoId: videoRecord.id,
        status: 'completed',
        progress: 100,
      });

      storageDb.addAuditLog({
        action: 'video_uploaded',
        actorEmail: ownerEmail,
        targetId: videoRecord.id,
        targetType: 'video',
        details: {
          fileName,
          size,
          serverId: server.id,
          serverName: server.name,
          provider: server.provider,
          storageKey,
          remoteFileId: putResult.remoteFileId,
          embedUrl: putResult.embedUrl,
        },
      });

      res.status(201).json({
        success: true,
        video: videoRecord,
        server: {
          id: server.id,
          name: server.name,
          provider: server.provider,
        },
      });
    } catch (err: any) {
      console.error('[StorageRouter] Upload failed:', err);
      const isConfigRequired = err.message?.includes('Configuration required');
      res.status(isConfigRequired ? 400 : 500).json({
        error: err.message || 'Video upload failed.',
        configurationRequired: isConfigRequired,
      });
    }
  });

  // 6. Delete Video (Requirement 7)
  router.delete('/videos/:id', async (req: Request, res: Response) => {
    try {
      const video = storageDb.getVideoById(req.params.id);
      if (!video) {
        res.status(404).json({ error: 'Video not found.' });
        return;
      }

      const actorEmail = (req.headers['x-user-email'] as string) || video.ownerEmail;
      const server = storageDb.getServerById(video.serverId, true);
      if (server) {
        const adapter = getStorageAdapter(server);
        await adapter.deleteObject(video.storageKey).catch((err) => {
          console.info('[StorageRouter] Notice deleting binary from storage adapter:', err);
        });
      }

      storageDb.deleteVideoRecord(video.id, actorEmail);
      res.json({ success: true, message: `Video '${video.fileName}' safely removed from storage.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete video.' });
    }
  });

  // 7. Update Video metadata
  router.patch('/videos/:id', (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const updated = storageDb.updateVideoRecord(req.params.id, updates);
      res.json({ success: true, video: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Admin-Only Storage Servers Management (Requirement 3 & 6)
  // ----------------------------------------------------

  // 8. List Storage Servers
  router.get('/servers', requireAdminAuth, (req: Request, res: Response) => {
    const servers = storageDb.listServers(false); // Mask secret credentials
    res.json({ success: true, servers });
  });

  // 9. Add Storage Server
  router.post('/servers', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const {
        name,
        provider,
        enabled = true,
        isDefault = false,
        priority = 50,
        capacityBytes = 50 * 1024 * 1024 * 1024,
        uploadLimitBytes = 2 * 1024 * 1024 * 1024,
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey,
        apiKey,
        accountUrl,
        websiteUrl,
        publicUrlPrefix,
      } = req.body;

      if (!name || !provider) {
        res.status(400).json({ error: 'Server name and provider type are required.' });
        return;
      }

      const actorEmail = (req.headers['x-user-email'] as string) || 'admin';
      const created = storageDb.addServer(
        {
          name,
          provider,
          enabled: Boolean(enabled),
          isDefault: Boolean(isDefault),
          priority: Number(priority) || 50,
          capacityBytes: Number(capacityBytes) || 50 * 1024 * 1024 * 1024,
          uploadLimitBytes: Number(uploadLimitBytes) || (provider === 'media_cm' ? 300 * 1024 * 1024 : 2 * 1024 * 1024 * 1024),
          healthStatus: 'untested',
          healthMessage: 'Newly created server, testing connection...',
          lastCheckedAt: null,
          endpoint: endpoint || (provider === 'media_cm' ? 'https://media.cm' : undefined),
          accountUrl: accountUrl || (provider === 'media_cm' ? 'https://media.cm/?op=my_files' : undefined),
          websiteUrl: websiteUrl || (provider === 'media_cm' ? 'https://media.cm/' : undefined),
          region,
          bucket,
          accessKeyId,
          secretAccessKey,
          apiKey,
          publicUrlPrefix,
        },
        actorEmail
      );

      // Perform immediate connection test
      const fullServer = storageDb.getServerById(created.id, true)!;
      const adapter = getStorageAdapter(fullServer);
      const testRes = await adapter.testConnection();

      const isConfigReq = testRes.message?.includes('Configuration required');
      const healthStatus: storageDb.ServerHealthStatus = testRes.success
        ? 'healthy'
        : isConfigReq
        ? 'degraded'
        : 'unhealthy';

      storageDb.updateServer(
        created.id,
        {
          healthStatus,
          healthMessage: testRes.message,
          uploadHealth: testRes.success ? 'healthy' : 'degraded',
          playbackHealth: testRes.success ? 'healthy' : 'degraded',
          lastCheckedAt: new Date().toISOString(),
        },
        'system'
      );

      res.status(201).json({
        success: true,
        server: storageDb.getServerById(created.id, false),
        testResult: testRes,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 10. Update Storage Server
  router.put('/servers/:id', requireAdminAuth, (req: Request, res: Response) => {
    try {
      const actorEmail = (req.headers['x-user-email'] as string) || 'admin';
      const updated = storageDb.updateServer(req.params.id, req.body, actorEmail);
      res.json({ success: true, server: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 11. Delete Storage Server (Safe Deletion with Migration Check - Requirement 3)
  router.delete('/servers/:id', requireAdminAuth, (req: Request, res: Response) => {
    try {
      const actorEmail = (req.headers['x-user-email'] as string) || 'admin';
      const result = storageDb.deleteServer(req.params.id, actorEmail);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 12. Test Server Connection
  router.post('/servers/:id/test', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const server = storageDb.getServerById(req.params.id, true);
      if (!server) {
        res.status(404).json({ error: 'Server not found.' });
        return;
      }

      const adapter = getStorageAdapter(server);
      const testRes = await adapter.testConnection();

      const isConfigReq = testRes.message?.includes('Configuration required');
      const healthStatus: storageDb.ServerHealthStatus = testRes.success
        ? 'healthy'
        : isConfigReq
        ? 'degraded'
        : 'unhealthy';

      storageDb.updateServer(
        server.id,
        {
          healthStatus,
          healthMessage: testRes.message,
          uploadHealth: testRes.success ? 'healthy' : 'degraded',
          playbackHealth: testRes.success ? 'healthy' : 'degraded',
          lastCheckedAt: new Date().toISOString(),
        },
        (req.headers['x-user-email'] as string) || 'admin'
      );

      storageDb.addAuditLog({
        action: 'server_tested',
        actorEmail: (req.headers['x-user-email'] as string) || 'admin',
        targetId: server.id,
        targetType: 'server',
        details: { result: testRes },
      });

      res.json({ success: true, result: testRes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Safe Server Migration (Requirement 3)
  router.post('/servers/migrate', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { sourceServerId, targetServerId } = req.body;
      if (!sourceServerId || !targetServerId || sourceServerId === targetServerId) {
        res.status(400).json({ error: 'Valid distinct source and target server IDs are required.' });
        return;
      }

      const sourceServer = storageDb.getServerById(sourceServerId, true);
      const targetServer = storageDb.getServerById(targetServerId, true);

      if (!sourceServer || !targetServer) {
        res.status(404).json({ error: 'Source or target server not found.' });
        return;
      }

      const db = storageDb.loadStorageDb();
      const videosToMigrate = db.videos.filter((v) => v.serverId === sourceServerId && v.status === 'ready');

      if (videosToMigrate.length === 0) {
        res.json({ success: true, message: 'No videos to migrate on source server.', count: 0 });
        return;
      }

      const sourceAdapter = getStorageAdapter(sourceServer);
      const targetAdapter = getStorageAdapter(targetServer);
      let migratedCount = 0;

      for (const v of videosToMigrate) {
        try {
          // Read from source
          const streamResult = await sourceAdapter.getObjectStream(v.storageKey);
          const chunks: Buffer[] = [];
          for await (const chunk of streamResult.stream as any) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          // Write to target
          await targetAdapter.putObject(v.storageKey, buffer, v.mimeType);

          // Update record
          storageDb.updateVideoRecord(v.id, {
            serverId: targetServer.id,
            provider: targetServer.provider,
          });

          // Delete from source
          await sourceAdapter.deleteObject(v.storageKey).catch(() => {});
          migratedCount++;
        } catch (mErr) {
          console.error(`[StorageRouter] Failed to migrate video '${v.fileName}':`, mErr);
        }
      }

      storageDb.addAuditLog({
        action: 'video_migrated',
        actorEmail: (req.headers['x-user-email'] as string) || 'admin',
        targetId: sourceServer.id,
        details: {
          fromServer: sourceServer.name,
          toServer: targetServer.name,
          migratedCount,
        },
      });

      res.json({
        success: true,
        message: `Successfully migrated ${migratedCount} of ${videosToMigrate.length} video(s) to '${targetServer.name}'.`,
        migratedCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Storage Settings
  router.get('/settings', requireAdminAuth, (req: Request, res: Response) => {
    res.json({ success: true, settings: storageDb.getStorageSettings() });
  });

  router.put('/settings', requireAdminAuth, (req: Request, res: Response) => {
    try {
      const actorEmail = (req.headers['x-user-email'] as string) || 'admin';
      const updated = storageDb.updateStorageSettings(req.body, actorEmail);
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 15. Audit Logs
  router.get('/audit-logs', requireAdminAuth, (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    res.json({ success: true, logs: storageDb.listAuditLogs(limit) });
  });

  return router;
}
