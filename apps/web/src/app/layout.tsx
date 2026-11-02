import "../styles/globals.css";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VitalSense — Privacy-First Health Intelligence",
  description: "Unified cross-platform health analytics, daily intelligence briefing, and offline-first synchronization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-[#0B0F17] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      <body className="min-h-screen flex flex-col font-sans bg-[#0B0F17] text-slate-100">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
