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
  title: "SHOWER TRACKER",
  description: "One shower at a time. Hot water coordination for the household.",
  openGraph: {
    title: "🚿 SHOWER TRACKER",
    description: "One shower at a time. Claim your slot, respect the queue.",
    type: "website",
    siteName: "Shower Tracker",
  },
  twitter: {
    card: "summary",
    title: "🚿 SHOWER TRACKER",
    description: "One shower at a time. Claim your slot, respect the queue.",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "theme-color": "#F5F0E8",
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
