import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-6">
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-li-cyan/60" />
          <span className="text-xs font-mono text-white/30">
            Latent Ocean
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Legacy App
          </Link>
          <span className="text-xs text-white/20">
            Built by Diren Kumaratilleke
          </span>
        </div>
      </div>
    </footer>
  );
}
