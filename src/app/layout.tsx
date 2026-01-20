import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Analytics - GPS/Wearable + Tactical Intelligence",
  description: "Advanced football analytics system integrating GPS/wearable tracking data with tactical game models. Create digital twins, define game approaches, and monitor live coherence between player data and managerial instructions.",
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
