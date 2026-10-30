import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isHostedPreview = Boolean(
  process.env.APPLET_ID ||
  process.env.K_SERVICE ||
  process.env.NG_ALLOWED_HOSTS
);

function aiStudioPreviewHmrPlugin(): Plugin {
  return {
    name: 'ai-studio-preview-hmr-guard',
    transform(code, id) {
      if (id.includes('client.mjs') || id.includes('/@vite/client')) {
        let transformed = code;
        // In hosted AI Studio preview, HMR WebSocket is not exposed across Cloud Run ingress.
        // Guard transport.connect so the browser does not attempt an unreachable WebSocket.
        if (transformed.includes('transport.connect(createHMRHandler(handleMessage));')) {
          transformed = transformed.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            `if (typeof window !== 'undefined' && (window.location.hostname.includes('.run.app') || window.location.hostname.includes('google.com') || window.location.hostname === '0.0.0.0')) {
              console.debug('[Vite] Running in hosted AI Studio preview mode. HMR WebSocket skipped.');
            } else {
              transport.connect(createHMRHandler(handleMessage)).catch(() => {});
            }`
          );
        }
        return transformed;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aiStudioPreviewHmrPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true,
    allowedHosts: true,
    hmr: isHostedPreview
      ? false
      : {
          overlay: false,
        },
    watch: {
      usePolling: true,
    },
  },
  legacy: {
    skipWebSocketTokenCheck: true,
  },
});


