import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { ProductPage } from "@/components/products/ProductPage";
import { productBySlug } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Atlas · Latent Ocean",
  description: "Make your analysis reproducible. Forever. Topology, baselines, drift over time, statistical significance — every output ships with a permanent receipt anyone can verify.",
};

export default function AtlasPage() {
  const product = productBySlug("atlas");
  if (!product) return null;
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <ProductPage product={product} />
    </div>
  );
}
