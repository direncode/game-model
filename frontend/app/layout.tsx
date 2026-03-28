import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/Providers";
import { GridBackground } from "@/components/effects/GridBackground";

export const metadata: Metadata = {
  title: "Latent Intelligence",
  description: "Enterprise Structure Discovery Platform — Discover hidden structural relationships in any entity-relationship dataset.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#ffffff",
          colorBackground: "#0f0f0f",
          colorInputBackground: "#000000",
          colorInputText: "#ffffff",
          colorText: "#ffffff",
        },
      }}
    >
      <html lang="en" className="dark">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-black text-white font-sans antialiased">
          <GridBackground />
          <div className="gradient-top" />
          <Providers>
            <div className="relative z-20">
              {children}
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
