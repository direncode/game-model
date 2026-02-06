import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BigDunc — Resonance Kernel Algorithm Flow",
  description: "Quantum-inspired pre-decision engine for football team dynamics. Visualizes the resonance kernel algorithm pipeline in real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
