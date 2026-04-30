"use client";
import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

/**
 * Home hero — the entire above-the-fold for /
 *
 * Composition:
 *   - massive "Console" wordmark with a backlit light-burst behind it
 *     (animated glow on the right, drifting horizontal streak)
 *   - inquiry input "What do you want to know?" that POSTs to /console
 *     with the question carried as a query param
 *   - announcement strip lower-right
 *   - scroll-down indicator lower-left
 *
 * Animation details:
 *   - the wordmark fades + scales in over 1.4s
 *   - the right-side light orb drifts on a 14s ease-in-out loop
 *   - a horizontal streak passes left-to-right on a 9s loop
 *   - the input box rises last
 */
export function HomeHero() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [armed, setArmed] = useState(false);

  const submit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const text = q.trim();
    if (!text) {
      router.push("/console");
      return;
    }
    router.push(`/console?q=${encodeURIComponent(text)}`);
  }, [q, router]);

  // Tiny entrance delay so the word lands before the input
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black flex flex-col">
      {/* ============= LIGHT BURST LAYER (the xAI signature) ============= */}
      {/* Right-side orb — the bright light source */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 z-0"
      >
        <div className="absolute right-[-8vw] top-1/2 -translate-y-1/2 w-[68vw] h-[78vh] hb-orb" />
        <div className="absolute right-[-2vw] top-1/2 -translate-y-1/2 w-[42vw] h-[42vw] hb-core" />
        {/* horizontal sweep */}
        <div className="absolute inset-y-0 left-0 right-0 hb-sweep" />
        {/* subtle vignette so edges go to true black */}
        <div className="absolute inset-0 hb-vignette" />
      </motion.div>

      {/* ============= WORDMARK ============= */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="relative w-full max-w-[1480px] mx-auto">
          <motion.h1
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className="hb-word relative font-display select-none text-center leading-[0.85] tracking-[-0.06em] text-white font-medium"
            style={{ fontSize: "clamp(120px, 22vw, 360px)" }}
          >
            Console
          </motion.h1>
        </div>
      </div>

      {/* ============= INQUIRY BOX ============= */}
      <div className="relative z-20 px-6 pb-32 md:pb-36">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 18 }}
          animate={armed ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[860px] flex items-center gap-2 rounded-full border border-white/15 bg-black/65 backdrop-blur-md px-5 py-3.5 hover:border-white/30 focus-within:border-white/40 transition-colors"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What do you want to know?"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
          <button
            type="submit"
            aria-label="Open in Console"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 11.5V2.5m0 0L3 6.5m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </motion.form>
      </div>

      {/* ============= LOWER STRIP: scroll arrow (left), announcement (right) ============= */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-8 flex items-end justify-between gap-6">
        {/* Scroll-down arrow */}
        <motion.a
          href="#beneath"
          aria-label="Scroll for more"
          initial={{ opacity: 0 }}
          animate={armed ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/35 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="hb-arrow">
            <path d="M7 2.5v9m0 0L3 7.5m4 4l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.a>

        {/* Announcement strip — text-left + outlined pill on the right */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={armed ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-end sm:items-center gap-3 sm:gap-5 max-w-[640px] text-right sm:text-left"
        >
          <div className="text-[13.5px] leading-snug text-white/85">
            <div className="font-medium">Announcing Range Console MMXXVI · 1.0.</div>
            <div className="text-white/55">Mount any corpus. Form a deterministic private model. Air-gap by default.</div>
          </div>
          <Link
            href="/console"
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 rounded-full border border-white/30 text-white text-[11px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors"
          >
            Try Console
          </Link>
        </motion.div>
      </div>

      {/* ============= STYLES ============= */}
      <style jsx>{`
        /* Right-side orb — the main backlit glow */
        .hb-orb {
          background: radial-gradient(
            ellipse at center,
            rgba(255,255,255,0.55) 0%,
            rgba(255,255,255,0.22) 18%,
            rgba(255,255,255,0.06) 38%,
            transparent 65%
          );
          filter: blur(60px);
          animation: hb-orb-drift 14s ease-in-out infinite;
        }
        /* Tighter bright core */
        .hb-core {
          background: radial-gradient(
            circle at center,
            rgba(255,255,255,0.92) 0%,
            rgba(255,255,255,0.45) 14%,
            rgba(255,255,255,0.12) 32%,
            transparent 56%
          );
          filter: blur(40px);
          mix-blend-mode: screen;
          animation: hb-core-pulse 7s ease-in-out infinite;
        }
        /* Horizontal sweep — the cinematic light streak passing across */
        .hb-sweep {
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 28%,
            rgba(255,255,255,0.04) 50%,
            rgba(255,255,255,0.10) 62%,
            rgba(255,255,255,0.04) 76%,
            transparent 100%
          );
          mix-blend-mode: screen;
          animation: hb-sweep-pan 9s ease-in-out infinite;
        }
        /* Edge vignette — black corners */
        .hb-vignette {
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 50%,
            rgba(0,0,0,0.55) 88%,
            rgba(0,0,0,0.85) 100%
          );
        }
        /* Wordmark — backlit, partially blown-out on the right */
        .hb-word {
          background-image: linear-gradient(
            90deg,
            rgba(255,255,255,0.55) 0%,
            rgba(255,255,255,0.78) 40%,
            rgba(255,255,255,1) 65%,
            rgba(255,255,255,1) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          text-shadow:
            0 0 60px rgba(255,255,255,0.12),
            0 0 120px rgba(255,255,255,0.08);
          filter: drop-shadow(0 0 18px rgba(255,255,255,0.04));
          animation: hb-word-shimmer 11s ease-in-out infinite;
        }
        .hb-arrow {
          animation: hb-arrow-bounce 2.6s ease-in-out infinite;
        }

        @keyframes hb-orb-drift {
          0%, 100% { transform: translate(0, -50%) scale(1); opacity: 1; }
          50%      { transform: translate(-3vw, -50%) scale(1.04); opacity: 0.92; }
        }
        @keyframes hb-core-pulse {
          0%, 100% { opacity: 0.85; transform: translateY(-50%) scale(1); }
          50%      { opacity: 1;    transform: translateY(-50%) scale(1.06); }
        }
        @keyframes hb-sweep-pan {
          0%, 100% { transform: translateX(-12%); opacity: 0.6; }
          50%      { transform: translateX( 14%); opacity: 1; }
        }
        @keyframes hb-word-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes hb-arrow-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(3px); }
        }
        @media (max-width: 768px) {
          .hb-word {
            background-image: linear-gradient(
              90deg,
              rgba(255,255,255,0.7) 0%,
              rgba(255,255,255,1) 60%,
              rgba(255,255,255,1) 100%
            );
          }
        }
      `}</style>
    </section>
  );
}
