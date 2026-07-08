'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
}

const PARTICLE_COUNT = 55;
const CONNECTION_DISTANCE = 160;
const MOUSE_RADIUS = 220;
const BASE_SPEED = 0.35;
// CauseFlow Electric Teal: hsl(172 66% 30%) ≈ rgb(26,127,113)
const R = 26;
const G = 127;
const B = 113;

function rgba(a: number) {
  return `rgba(${R},${G},${B},${a})`;
}

export function NetworkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * BASE_SPEED,
        vy: (Math.random() - 0.5) * BASE_SPEED,
        radius: Math.random() * 1.8 + 0.8,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.004,
      }));
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const tick = () => {
      const { width, height } = canvas;
      const ps = particlesRef.current;
      const m = mouseRef.current;

      ctx.clearRect(0, 0, width, height);

      // ── Update positions ───────────────────────────────────────────────
      for (const p of ps) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const d = Math.hypot(dx, dy);

        if (d < MOUSE_RADIUS && d > 1) {
          const strength = ((MOUSE_RADIUS - d) / MOUSE_RADIUS) * 0.012;
          p.vx += (dx / d) * strength;
          p.vy += (dy / d) * strength;
        }

        // Soft speed cap
        const spd = Math.hypot(p.vx, p.vy);
        const cap = BASE_SPEED * 2.5;
        if (spd > cap) {
          p.vx = (p.vx / spd) * cap;
          p.vy = (p.vy / spd) * cap;
        }

        // Damping + gentle random drift to keep particles alive
        p.vx = p.vx * 0.985 + (Math.random() - 0.5) * 0.008;
        p.vy = p.vy * 0.985 + (Math.random() - 0.5) * 0.008;

        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;

        // Wrap edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }

      // ── Particle-to-particle connections ──────────────────────────────
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i]!.x - ps[j]!.x;
          const dy = ps[i]!.y - ps[j]!.y;
          const d = Math.hypot(dx, dy);
          if (d < CONNECTION_DISTANCE) {
            const alpha = (1 - d / CONNECTION_DISTANCE) * 0.18;
            ctx.beginPath();
            ctx.moveTo(ps[i]!.x, ps[i]!.y);
            ctx.lineTo(ps[j]!.x, ps[j]!.y);
            ctx.strokeStyle = rgba(alpha);
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // ── Mouse-to-particle connections ─────────────────────────────────
      for (const p of ps) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < MOUSE_RADIUS) {
          const alpha = (1 - d / MOUSE_RADIUS) * 0.35;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(m.x, m.y);
          ctx.strokeStyle = rgba(alpha);
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      // ── Draw nodes (squares) ──────────────────────────────────────────
      for (const p of ps) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const d = Math.hypot(dx, dy);
        const boost = d < MOUSE_RADIUS ? 1 + (1 - d / MOUSE_RADIUS) * 0.8 : 1;
        const half = p.radius * boost;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Glow halo — slightly larger faded square
        ctx.fillStyle = rgba(0.12 * boost);
        ctx.fillRect(-half * 3, -half * 3, half * 6, half * 6);

        // Core square
        ctx.fillStyle = rgba(0.6 * boost);
        ctx.fillRect(-half, -half, half * 2, half * 2);

        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    init();

    const ro = new ResizeObserver(init);
    ro.observe(canvas);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);

    tick();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
