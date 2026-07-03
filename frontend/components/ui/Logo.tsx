"use client";

/* Animated logo mark — a triangle of three orbiting dots in the brand palette. */
import { motion } from "framer-motion";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(124 92 255)" />
            <stop offset="50%" stopColor="rgb(92 240 255)" />
            <stop offset="100%" stopColor="rgb(255 92 180)" />
          </linearGradient>
        </defs>
        <path
          d="M16 3 L29 26 L3 26 Z"
          fill="none"
          stroke="url(#logoG)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
      {[
        { color: "rgb(124 92 255)", r: 2.2, dur: 4, delay: 0 },
        { color: "rgb(92 240 255)", r: 2.2, dur: 4, delay: 1.3 },
        { color: "rgb(255 92 180)", r: 2.2, dur: 4, delay: 2.6 },
      ].map((d, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }}
          animate={{
            x: [
              Math.cos((i * 2 * Math.PI) / 3) * 10,
              Math.cos(((i * 2 * Math.PI) / 3) + (2 * Math.PI) / 3) * 10,
              Math.cos((i * 2 * Math.PI) / 3) * 10,
            ],
            y: [
              Math.sin((i * 2 * Math.PI) / 3) * 10,
              Math.sin(((i * 2 * Math.PI) / 3) + (2 * Math.PI) / 3) * 10,
              Math.sin((i * 2 * Math.PI) / 3) * 10,
            ],
          }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}
