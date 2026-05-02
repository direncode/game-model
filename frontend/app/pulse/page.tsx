import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { ProductPage } from "@/components/products/ProductPage";
import { productBySlug } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Pulse · Latent Ocean",
  description: "Find the duplicates and look-alikes hiding in your data. Schema-agnostic, byte-identical re-runs, deploys in five minutes. Consumer, Pro, and Enterprise tiers.",
};

export default function PulsePage() {
  const product = productBySlug("pulse");
  if (!product) return null;
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <ProductPage product={product} />
    </div>
  );
}
