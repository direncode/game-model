import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { ProductPage } from "@/components/products/ProductPage";
import { productBySlug } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Studio · Latent Ocean",
  description: "Your archive, mapped in a day. Concierge service for institutions with archives, libraries, or large document collections. We deliver a full structural map in 24 hours, then keep enriching it every month.",
};

export default function StudioPage() {
  const product = productBySlug("studio");
  if (!product) return null;
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <ProductPage product={product} />
    </div>
  );
}
