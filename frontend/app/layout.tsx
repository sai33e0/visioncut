import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const interDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VisionCut AI — Reference-Driven Video Editing",
  description:
    "Upload a reference video and your raw footage. The system understands the editing style, identifies required assets, explains every decision, and automatically recreates a similar edit using only your media.",
};

export const viewport: Viewport = {
  themeColor: "#07070e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${interDisplay.variable} ${mono.variable}`}
    >
      <body className="grain">
        <div className="aurora-bg" aria-hidden>
          <div className="aurora-third" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
