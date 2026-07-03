"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { easeOut } from "@/lib/motion";

export function AuthShell({
  side,
  children,
}: {
  side: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen">
      {/* Left visual panel — hidden on mobile */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgb(124 92 255 / 0.5), transparent 50%), radial-gradient(circle at 70% 80%, rgb(92 240 255 / 0.4), transparent 50%), radial-gradient(circle at 50% 50%, rgb(255 92 180 / 0.2), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(circle at center, black, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-display text-base font-semibold">VisionCut AI</span>
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOut }}
            className="max-w-md"
          >
            {side}
          </motion.div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-3">
            v1.0 · aurora build
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size={26} />
            <span className="font-display text-sm font-semibold">VisionCut AI</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="w-full max-w-sm"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
