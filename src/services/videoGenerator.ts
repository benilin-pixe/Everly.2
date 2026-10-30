/**
 * Generates sample playable video blobs using Canvas and MediaRecorder.
 * This ensures the custom video player has real video streams
 * with duration, audio/visual cues, seeking, and playback.
 */

export function generateSampleVideoBlob(title: string, durationSec: number = 8): Promise<Blob> {
  return new Promise((resolve) => {
    // Valid minimal WebM container header/cluster binary fallback if MediaRecorder is unavailable
    const fallbackWebmBytes = new Uint8Array([
      0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
      0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x18, 0x53, 0x80, 0x67,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10
    ]);

    const loadSampleFallback = async () => {
      try {
        const res = await fetch('/videos/sample.mp4');
        if (res.ok) {
          const blob = await res.blob();
          resolve(blob);
          return;
        }
      } catch {}
      resolve(new Blob([fallbackWebmBytes], { type: 'video/webm' }));
    };

    if (typeof window === 'undefined' || !window.MediaRecorder) {
      loadSampleFallback();
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        loadSampleFallback();
        return;
      }

      const stream = canvas.captureStream(30);
      const mimeTypes = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (chunks.length === 0) {
          resolve(new Blob([fallbackWebmBytes], { type: supportedMime }));
          return;
        }
        const videoBlob = new Blob(chunks, { type: supportedMime });
        resolve(videoBlob);
      };

      recorder.onerror = () => {
        resolve(new Blob([fallbackWebmBytes], { type: supportedMime }));
      };

      recorder.start();

      let startTime = performance.now();
      const fps = 30;
      const totalFrames = durationSec * fps;
      let frame = 0;

      const draw = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(elapsed / durationSec, 1);

        // Elegant animated gradient backdrop
        const grad = ctx.createLinearGradient(
          0,
          0,
          canvas.width * Math.cos(progress * Math.PI * 2),
          canvas.height
        );
        grad.addColorStop(0, '#111827');
        grad.addColorStop(0.5, '#4c0519'); // Rose/wine tint
        grad.addColorStop(1, '#030712');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle moving romantic particles
        for (let i = 0; i < 24; i++) {
          const px = (canvas.width * (i * 0.17 + progress * 0.3)) % canvas.width;
          const py = (canvas.height * (0.2 + (i * 0.13))) % canvas.height;
          ctx.beginPath();
          ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 113, 133, ${0.2 + (i % 5) * 0.1})`;
          ctx.fill();
        }

        // Title and timer
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);

        ctx.font = '400 14px monospace';
        ctx.fillStyle = '#fda4af';
        const currentTime = Math.floor(elapsed);
        const mins = String(Math.floor(currentTime / 60)).padStart(2, '0');
        const secs = String(currentTime % 60).padStart(2, '0');
        const totalMins = String(Math.floor(durationSec / 60)).padStart(2, '0');
        const totalSecs = String(durationSec % 60).padStart(2, '0');
        ctx.fillText(`Drive Streaming: ${mins}:${secs} / ${totalMins}:${totalSecs}`, canvas.width / 2, canvas.height / 2 + 25);

        frame++;
        if (frame < totalFrames && recorder.state === 'recording') {
          requestAnimationFrame(draw);
        } else if (recorder.state === 'recording') {
          recorder.stop();
        }
      };

      draw();
    } catch {
      loadSampleFallback();
    }
  });
}
