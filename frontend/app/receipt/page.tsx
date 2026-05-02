import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { ProductPage } from "@/components/products/ProductPage";
import { productBySlug } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Receipt · Latent Ocean",
  description: "Make every AI decision provable. A permanent, citable hash on every model output. SIEM-ready logs in CEF and OCSF. For compliance, legal, and AI-governance teams who need to defend a decision in a regulator's office.",
};

export default function ReceiptPage() {
  const product = productBySlug("receipt");
  if (!product) return null;
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <ProductPage product={product} />
    </div>
  );
}
