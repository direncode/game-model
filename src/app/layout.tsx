import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BigDunc Analytics — Manchester United Match Intelligence",
  description: "Professional match analytics platform with real-time GPS tracking, tactical AI, digital twin technology, and coherence scoring for Manchester United.",
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
