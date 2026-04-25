"use client";

/**
 * Product navigation strip — sits above the Live Query dock at the
 * bottom of the canvas. Tab-row aesthetic, small caps, no icons.
 * One accent (li-cyan underline) on the active product.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

const PRODUCTS = [
  { href: "/nato-sim", label: "Daily Read" },
  { href: "/nato-sim/tasking", label: "Tasking" },
  { href: "/nato-sim/inbound", label: "Inbound" },
  { href: "/nato-sim/query", label: "Query" },
  { href: "/nato-sim/actors", label: "Country Files" },
  { href: "/nato-sim/watchboard", label: "Watchboard" },
  { href: "/nato-sim/gaps", label: "Gaps" },
  { href: "/nato-sim/agencies", label: "Agencies" },
  { href: "/nato-sim/network", label: "Network" },
  { href: "/nato-sim/dissents", label: "Alt Views" },
  { href: "/nato-sim/sources", label: "Sources" },
];

export function ProductNav() {
  const pathname = usePathname();
  return (
    <nav className="border-t border-li-border bg-li-black-surface/60 px-6">
      <ul className="flex items-stretch gap-6 text-[10px] tracking-[0.32em] uppercase font-mono">
        {PRODUCTS.map((p) => {
          const active =
            p.href === "/nato-sim"
              ? pathname === "/nato-sim"
              : pathname.startsWith(p.href);
          return (
            <li key={p.href} className="flex">
              <Link
                href={p.href}
                className={
                  "py-3 transition-colors border-b-2 " +
                  (active
                    ? "border-li-cyan text-li-text-primary"
                    : "border-transparent text-li-text-muted hover:text-li-text-secondary")
                }
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
