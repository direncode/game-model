'use client';

import { useEffect, useRef, useState } from 'react';

const METRICS = [
  { value: 40, suffix: '+', label: 'Tactical patterns detected in real-time' },
  { value: 6, suffix: '', label: 'Purpose-built algorithm modules' },
  { value: 4, suffix: '', label: 'Seamless data ingestors' },
  { value: 22, suffix: '', label: 'Autonomous agents modeled simultaneously' },
  { value: 1000, suffix: '', label: 'Monte Carlo simulations per decision' },
  { value: 7, suffix: '', label: 'xG modifiers for shot probability' },
];

function AnimatedCounter({ target, suffix, started }: { target: number; suffix: string; started: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!started) return;
    const duration = 1200;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, started]);

  return (
    <span className="metric-value">
      {started ? count.toLocaleString() : '0'}{suffix}
    </span>
  );
}

export function MetricsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section-full section-alt" ref={ref}>
      <div className="section-container">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {METRICS.map((m) => (
            <div key={m.label} className="text-center">
              <AnimatedCounter target={m.value} suffix={m.suffix} started={visible} />
              <div className="metric-label mt-2">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
