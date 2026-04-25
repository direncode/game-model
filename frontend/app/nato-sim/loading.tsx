/**
 * Global loading state for the /nato-sim vertical.
 *
 * Shown automatically by Next.js App Router during server-component
 * data fetches and route transitions. Restrained: a thin shimmer
 * letterhead skeleton + three text-row placeholders. No spinner —
 * the analyst should feel like the cable is being keyed in, not like
 * a slow website.
 */

function ShimmerLine({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return (
    <div
      className="rounded-sm bg-gradient-to-r from-li-gray-900 via-li-gray-800 to-li-gray-900 bg-[length:400%_100%] animate-[gradient-shift_2s_ease_infinite]"
      style={{ width: w, height: h }}
    />
  );
}

export default function NatoSimLoading() {
  return (
    <main>
      <div className="max-w-3xl mx-auto px-10 py-10 space-y-8">
        {/* Letterhead skeleton */}
        <header className="border-b-2 border-li-text-primary/20 pb-3">
          <div className="flex items-baseline justify-between gap-6">
            <div className="space-y-2.5">
              <ShimmerLine w="320px" h={22} />
              <ShimmerLine w="380px" h={10} />
            </div>
            <div className="space-y-1.5 w-24">
              <ShimmerLine w="80px" h={9} />
              <ShimmerLine w="80px" h={9} />
              <ShimmerLine w="60px" h={9} />
            </div>
          </div>
        </header>

        {/* Eyebrow + h1 + subtitle */}
        <section className="space-y-3">
          <ShimmerLine w="220px" h={10} />
          <ShimmerLine w="80%" h={28} />
          <ShimmerLine w="60%" h={12} />
        </section>

        <div className="h-px bg-li-border" />

        {/* Body lines */}
        <section className="space-y-3">
          <ShimmerLine w="100%" h={12} />
          <ShimmerLine w="95%" h={12} />
          <ShimmerLine w="92%" h={12} />
          <ShimmerLine w="88%" h={12} />
          <ShimmerLine w="50%" h={12} />
        </section>

        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted text-center pt-6">
          composing…
        </div>
      </div>
    </main>
  );
}
