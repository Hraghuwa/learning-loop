import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://learningloop.in";

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Learning Loop — Reasoning-first CAT prep",
    template: "%s · Learning Loop",
  },
  description:
    "Learning Loop captures your reasoning before you submit, then surgically diagnoses how you think. Build a cognitive fingerprint, fix the patterns that cost you marks, and ship a personalised study plan.",
  keywords: [
    "CAT preparation",
    "CAT exam",
    "reasoning practice",
    "cognitive diagnosis",
    "AI tutor",
    "MBA entrance",
    "learning analytics",
  ],
  authors: [{ name: "Learning Loop" }],
  openGraph: {
    type: "website",
    title: "Learning Loop — Reasoning-first CAT prep",
    description:
      "Most apps grade your answers. We diagnose how you think. Build your cognitive fingerprint and fix the patterns that cost you marks.",
    siteName: "Learning Loop",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning Loop — Reasoning-first CAT prep",
    description: "Most apps grade your answers. We diagnose how you think.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
