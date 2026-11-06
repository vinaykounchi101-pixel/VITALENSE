import "../styles/globals.css";
import React from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "../components/ThemeProvider";
import { SmoothScroll } from "../components/providers/SmoothScroll";

export const metadata: Metadata = {
  title: "VitalSense — Premium Personal Health Intelligence",
  description:
    "Privacy-first unified health analytics, biometric exploration, daily intelligence briefing, and offline-first synchronization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans bg-canvas text-text-primary selection:bg-brand selection:text-white">
        <ThemeProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}
