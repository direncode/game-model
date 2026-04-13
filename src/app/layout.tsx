import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D-U-N-C — Tactical Football Intelligence",
  description: "Wearable data, live. Digital twins. Real-time tactical detection. Powered by Latent Ocean.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-li-black text-li-white flex flex-col">
        {children}
      </body>
    </html>
  );
}
