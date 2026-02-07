import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BigDunc — Algorithm & Ingestor Platform",
  description: "Football analytics algorithm pipeline with seamless data ingestor modules. Pattern recognition, tactical AI, multi-agent systems, and real-time data ingestion.",
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
