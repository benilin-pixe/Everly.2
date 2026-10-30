import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { setupRealtimeWebSocket } from './server/realtimeServer.ts';
import { createEverlyApp } from './server/app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = createEverlyApp();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

export default app;

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const currentScript = process.argv[1] || '';
const isDirectExecution =
  currentScript === fileURLToPath(import.meta.url) ||
  currentScript.endsWith('server.ts') ||
  currentScript.endsWith('server.js');

// Only start the HTTP server and WebSockets when running directly as a standalone process
if (!isVercel && isDirectExecution) {
  async function startServer() {
    const PORT = Number(process.env.PORT) || 3000;
    const server = http.createServer(app);

    const commWss = new WebSocketServer({ noServer: true });
    setupRealtimeWebSocket(commWss);

    server.on('upgrade', (request, socket, head) => {
      try {
        const forwardedHost =
          (request.headers['x-forwarded-host'] as string) ||
          request.headers.host ||
          'localhost';
        const url = new URL(request.url || '', `http://${forwardedHost}`);
        if (url.pathname === '/api/ws' || url.pathname === '/ws') {
          commWss.handleUpgrade(request, socket, head, (ws) => {
            commWss.emit('connection', ws, request);
          });
        }
      } catch (err) {
        console.error('[Server Upgrade] Error handling websocket upgrade:', err);
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      const isHostedPreview = Boolean(
        process.env.APPLET_ID ||
        process.env.K_SERVICE ||
        process.env.NG_ALLOWED_HOSTS
      );

      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
          cors: true,
          hmr: isHostedPreview
            ? false
            : {
                server,
              },
        },
        legacy: {
          skipWebSocketTokenCheck: true,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Everly server running on http://0.0.0.0:${PORT}`);
    });
  }

  startServer();
}
