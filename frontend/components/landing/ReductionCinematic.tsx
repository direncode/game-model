"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const STAGES = [
  { label: "Input entities", value: "100,482", description: "Raw data from any source" },
  { label: "After pre-filter", value: "42,113", description: "Bloom + LSH + entropy gate" },
  { label: "After cascade", value: "3,847", description: "Multi-resolution reduction" },
  { label: "Survivors", value: "347", description: "Signal-rich entities remain" },
  { label: "Clusters", value: "8", description: "Structural groupings identified" },
];

export function ReductionCinematic() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section ref={ref} className="relative h-[500vh]" id="reduction">
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 w-full text-center">
          <motion.p
            className="font-mono text-xs uppercase tracking-[0.2em] text-white/40 mb-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            The Reduction
          </motion.p>

          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-20">
            A million points of noise.<br />
            <span className="text-white/40">A few hundred points of signal.</span>
          </h2>

          <div className="relative h-[300px]">
            {STAGES.map((stage, i) => {
              const stageStart = i / STAGES.length;
              const stageEnd = (i + 1) / STAGES.length;

              return (
                <StageCard
                  key={i}
                  stage={stage}
                  scrollYProgress={scrollYProgress}
                  start={stageStart}
                  end={stageEnd}
                  index={i}
                />
              );
            })}
          </div>

          <p className="mt-24 text-sm font-mono text-white/40">
            Scroll to watch the reduction →
          </p>
        </div>
      </div>
    </section>
  );
}

function StageCard({
  stage,
  scrollYProgress,
  start,
  end,
  index,
}: {
  stage: (typeof STAGES)[number];
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  index: number;
}) {
  const opacity = useTransform(
    scrollYProgress,
    [Math.max(0, start - 0.05), start + 0.02, end - 0.02, Math.min(1, end + 0.05)],
    [0, 1, 1, 0]
  );
  const y = useTransform(scrollYProgress, [start, end], [20, -20]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
        Stage {index + 1} of {STAGES.length}
      </div>
      <div className="font-mono text-[120px] md:text-[180px] leading-[0.9] font-light text-white tabular-nums">
        {stage.value}
      </div>
      <div className="mt-6 text-2xl text-white/70">{stage.label}</div>
      <div className="mt-2 text-sm text-white/40">{stage.description}</div>
    </motion.div>
  );
}
