import type { Metadata } from "next";
import { Archivo_Black, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1917" },
  ],
  title: "WATER HQ",
  description: "One shower at a time. Hot water coordination for the household.",
  openGraph: {
    title: "🚿 WATER HQ",
    description: "One shower at a time. Claim your slot, respect the queue.",
    type: "website",
    siteName: "Water HQ",
  },
  twitter: {
    card: "summary",
    title: "🚿 WATER HQ",
    description: "One shower at a time. Claim your slot, respect the queue.",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${spaceMono.variable}`}>
      <body className="font-mono antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
