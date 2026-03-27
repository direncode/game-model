"use client";

import { useEffect, useRef } from "react";

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridSize = 60;
    const lerpFactor = 0.05;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const draw = () => {
      if (!ctx || !canvas) return;

      // Lerp smooth mouse
      smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * lerpFactor;
      smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * lerpFactor;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = smoothMouseRef.current.x;
      const my = smoothMouseRef.current.y;

      // Draw grid lines
      for (let x = 0; x <= canvas.width; x += gridSize) {
        const dist = Math.abs(x - mx);
        const alpha = dist < 300 ? 0.03 + (1 - dist / 300) * 0.07 : 0.03;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y <= canvas.height; y += gridSize) {
        const dist = Math.abs(y - my);
        const alpha = dist < 300 ? 0.03 + (1 - dist / 300) * 0.07 : 0.03;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw intersection dots near mouse
      for (let x = 0; x <= canvas.width; x += gridSize) {
        for (let y = 0; y <= canvas.height; y += gridSize) {
          const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
          if (dist < 200) {
            const alpha = (1 - dist / 200) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}
