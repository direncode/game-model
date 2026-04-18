"use client";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  survivor: boolean;
  alpha: number;
  size: number;
};

export function ReductionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let w = 0, h = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Seed particles
    const count = 1200;
    const particles: Particle[] = [];
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 100 + Math.random() * Math.min(w, h) * 0.4;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const survivor = Math.random() < 0.12; // ~12% are survivors
      particles.push({
        x, y, baseX: x, baseY: y,
        vx: 0, vy: 0,
        survivor,
        alpha: survivor ? 0.9 : 0.25,
        size: survivor ? 1.5 : 0.8,
      });
    }
    particlesRef.current = particles;

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    canvas.addEventListener("mousemove", onMouse);

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const time = t * 0.001;

      for (const p of particles) {
        // Slow orbital drift
        const dx = p.baseX - cx;
        const dy = p.baseY - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + (p.survivor ? 0.0003 : 0.0001);
        p.baseX = cx + Math.cos(angle) * r;
        p.baseY = cy + Math.sin(angle) * r;

        // Subtle breathing pulse
        const breathe = Math.sin(time + r * 0.01) * 2;
        p.x = p.baseX + breathe;
        p.y = p.baseY + breathe;

        // Mouse attraction for nearby particles
        const mdx = mouseRef.current.x - p.x;
        const mdy = mouseRef.current.y - p.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 120) {
          p.x += (mdx / mdist) * 3;
          p.y += (mdy / mdist) * 3;
        }

        // Draw
        ctx.beginPath();
        if (p.survivor) {
          ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`;
          ctx.shadowBlur = 12;
          ctx.shadowColor = "rgba(0, 212, 255, 0.8)";
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
          ctx.shadowBlur = 0;
        }
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouse);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
