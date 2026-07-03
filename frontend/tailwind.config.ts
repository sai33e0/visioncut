import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        16: "repeat(16, minmax(0, 1fr))",
      },
      colors: {
        /* New 2027 tokens */
        bg: {
          0: "rgb(var(--bg-0) / <alpha-value>)",
          1: "rgb(var(--bg-1) / <alpha-value>)",
          2: "rgb(var(--bg-2) / <alpha-value>)",
          3: "rgb(var(--bg-3) / <alpha-value>)",
        },
        fg: {
          0: "rgb(var(--fg-0) / <alpha-value>)",
          1: "rgb(var(--fg-1) / <alpha-value>)",
          2: "rgb(var(--fg-2) / <alpha-value>)",
          3: "rgb(var(--fg-3) / <alpha-value>)",
        },
        line: {
          1: "rgb(var(--line-1) / <alpha-value>)",
          2: "rgb(var(--line-2) / <alpha-value>)",
        },
        violet: "rgb(var(--violet) / <alpha-value>)",
        cyan: "rgb(var(--cyan) / <alpha-value>)",
        magenta: "rgb(var(--magenta) / <alpha-value>)",
        lime: "rgb(var(--lime) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",

        /* Legacy aliases — old components keep working */
        background: "rgb(var(--bg-1) / <alpha-value>)",
        foreground: "rgb(var(--fg-0) / <alpha-value>)",
        muted: "rgb(var(--bg-2) / <alpha-value>)",
        "muted-foreground": "rgb(var(--fg-2) / <alpha-value>)",
        border: "rgb(var(--line-1) / <alpha-value>)",
        primary: "rgb(var(--violet) / <alpha-value>)",
        "primary-foreground": "rgb(255 255 255 / <alpha-value>)",
        accent: "rgb(var(--bg-3) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "fade-up": "fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2s linear infinite",
        float: "float-y 6s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        gradient: "gradient-shift 8s cubic-bezier(0.16, 1, 0.3, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
