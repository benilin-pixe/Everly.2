import React, { useEffect, useRef } from 'react';

// Romantic particle atmosphere
interface Particle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
  hue: number; // warm rose / gold / white
}

export const StarfieldParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Create 45 ambient starlight / rose-gold particles
    const particleCount = Math.min(50, Math.floor((width * height) / 25000));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.8,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25 - 0.08, // Subtle upward drift
        alpha: Math.random() * 0.6 + 0.2,
        baseAlpha: Math.random() * 0.4 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        hue: Math.random() > 0.4 ? 350 : 38, // Rose tint or Warm Golden tint
      });
    }

    let time = 0;
    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Twinkle effect
        const currentAlpha = p.baseAlpha + Math.sin(time * p.twinkleSpeed * 100) * 0.2;
        const safeAlpha = Math.max(0.05, Math.min(0.85, currentAlpha));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        // Warm aesthetic: soft rose or gentle champagne gold
        if (p.hue === 350) {
          ctx.fillStyle = `rgba(251, 113, 133, ${safeAlpha})`; // Rose
          ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
        } else {
          ctx.fillStyle = `rgba(253, 230, 138, ${safeAlpha})`; // Warm gold
          ctx.shadowColor = 'rgba(251, 191, 36, 0.3)';
        }
        ctx.shadowBlur = p.size * 3;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 opacity-70"
    />
  );
};
