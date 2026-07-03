"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Film,
  Sparkles,
  Wand2,
  BarChart3,
  Layers,
  MessageSquare,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { fadeUp, stagger, easeOut } from "@/lib/motion";

const AuroraScene = dynamic(
  () => import("@/components/three/AuroraScene").then((m) => m.AuroraScene),
  { ssr: false }
);

const FEATURES = [
  {
    icon: <Film className="h-5 w-5" />,
    title: "Reference intelligence",
    body:
      "Gemini 1.5 Pro + OpenCV + Whisper dissect the reference. Pace, transitions, audio type, and required asset types are mapped before a single clip is touched.",
  },
  {
    icon: <Wand2 className="h-5 w-5" />,
    title: "Style library",
    body:
      "Save successful edits as reusable styles. Apply a Travel Reel, Motivational Talk, or Lo-fi Vlog look to a new project in one click.",
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "Explainable AI",
    body:
      "Every clip selection shows why it was chosen, what didn't match, and offers swappable alternatives. No black-box decisions.",
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Feedback loop",
    body:
      "Thumbs up/down the segments. VisionCut learns your preferences and re-ranks clips for future projects automatically.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "GPU-accelerated render",
    body:
      "FFmpeg NVENC, parallel analyzers, and chunked uploads keep the pipeline fast even on hour-long reference videos.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Perceptual quality",
    body:
      "SSIM, pacing, transition, and audio match scores. Track improvement over time on your dashboard.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Upload a reference",
    body: "Drop the video whose style you want to recreate.",
  },
  {
    n: "02",
    title: "Drop your footage",
    body: "Raw clips — anything from phones, GoPros, or cameras.",
  },
  {
    n: "03",
    title: "Watch the edit build",
    body: "Live, explainable timeline. Swap, retime, replace — all visible.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D scene — only on capable devices, pointer-events disabled */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] opacity-80">
        <AuroraScene />
      </div>

      {/* ───── Top nav ───── */}
      <header className="container-page flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-display text-base font-semibold tracking-tight">VisionCut AI</span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/register" className="btn-primary">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      {/* ───── Hero ───── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={stagger(0.1)}
        className="container-page relative pt-20 pb-24 text-center md:pt-32"
      >
        <motion.div variants={fadeUp} className="mx-auto inline-flex">
          <span className="chip">
            <span className="pulse-dot" />
            Explainable AI video editing
            <span className="ml-1 text-fg-3">— v1.0</span>
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="display-xl mx-auto mt-8 max-w-5xl"
        >
          Re-create any editing style,
          <br />
          using{" "}
          <span className="text-gradient animate-gradient">only your footage.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-7 max-w-2xl text-lg text-fg-1"
        >
          Upload a reference video and your raw clips. VisionCut understands the
          style, finds the right moments, and builds the edit — explaining every
          decision along the way.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-7 py-3.5 text-base">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-outline px-7 py-3.5 text-base">
            I have an account
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-12 flex items-center justify-center gap-6 text-xs text-fg-2"
        >
          {["No credit card", "GPU-rendered", "Open blueprint"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-cyan" /> {t}
            </span>
          ))}
        </motion.div>
      </motion.section>

      {/* ───── Mock product surface ───── */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: easeOut }}
        className="container-page relative pb-32"
      >
        <div className="glass-card gradient-border overflow-hidden p-1.5">
          <div className="rounded-[14px] bg-bg-1/50 p-4">
            {/* fake window chrome */}
            <div className="flex items-center gap-1.5 px-2 pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[rgb(255_92_124/0.7)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[rgb(255_200_92/0.7)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[rgb(92_240_180/0.7)]" />
              <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-fg-3">
                visioncut / project / cinematic_travel_v2
              </span>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {/* preview pane */}
              <div className="col-span-12 md:col-span-8">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-bg-0">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, rgb(124 92 255 / 0.6), transparent 50%), radial-gradient(circle at 70% 70%, rgb(92 240 255 / 0.5), transparent 50%), radial-gradient(circle at 50% 90%, rgb(255 92 180 / 0.4), transparent 50%)",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="glass-strong rounded-full px-4 py-2 text-xs font-mono">
                      ▶ reference.mp4 · 00:00:08 / 00:02:14
                    </div>
                  </div>
                </div>

                {/* fake timeline */}
                <div className="timeline-track mt-3 p-2">
                  <div className="flex h-full gap-1">
                    {[16, 22, 14, 26, 18, 20, 24, 15, 22, 18, 26, 14, 20, 22, 18, 16].map((w, i) => (
                      <div
                        key={i}
                        className="rounded-md"
                        style={{
                          flex: w,
                          background: `linear-gradient(135deg, rgb(var(--violet) / ${0.2 + (i % 3) * 0.1}), rgb(var(--cyan) / ${0.1 + (i % 2) * 0.1}))`,
                          border: "1px solid rgb(255 255 255 / 0.05)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* side panel — explainability */}
              <div className="col-span-12 md:col-span-4 space-y-3">
                {[
                  { label: "Pace", value: "0.42s avg", color: "violet" },
                  { label: "Match", value: "94%", color: "cyan" },
                  { label: "Cuts", value: "112", color: "magenta" },
                ].map((m, i) => (
                  <div key={m.label} className="glass rounded-xl p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="label mb-0">{m.label}</span>
                      <span className={`font-display text-2xl text-${m.color}`}>{m.value}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full"
                        style={{
                          background: `linear-gradient(90deg, rgb(var(--violet)), rgb(var(--cyan)))`,
                        }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${60 + i * 12}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: easeOut }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ───── Feature grid ───── */}
      <section className="container-page pb-32">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <span className="label">// capabilities</span>
            <h2 className="display-lg mt-2 max-w-xl">
              The full pipeline, <span className="text-gradient">explained.</span>
            </h2>
          </div>
          <Link href="/register" className="hidden md:inline-flex link text-sm">
            See it run on a real video <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger(0.06)}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="glass-card p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet/20 to-cyan/10 text-violet-2 ring-1 ring-inset ring-white/10">
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-fg-0">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-2">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ───── How it works ───── */}
      <section className="container-page pb-32">
        <div className="mb-12">
          <span className="label">// how it works</span>
          <h2 className="display-lg mt-2 max-w-xl">
            Three steps. <span className="text-fg-2">No editing experience required.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: easeOut }}
              className="glass-card relative overflow-hidden p-6"
            >
              <span className="font-mono text-[11px] tracking-widest text-fg-3">
                STEP {s.n}
              </span>
              <h3 className="font-display mt-3 text-xl text-fg-0">{s.title}</h3>
              <p className="mt-2 text-sm text-fg-2">{s.body}</p>
              <div
                className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full opacity-30 blur-2xl"
                style={{
                  background:
                    i === 0 ? "rgb(124 92 255)" : i === 1 ? "rgb(92 240 255)" : "rgb(255 92 180)",
                }}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="container-page pb-24">
        <div className="glass-strong gradient-border relative overflow-hidden rounded-3xl p-12 text-center md:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, rgb(124 92 255 / 0.4), transparent 50%), radial-gradient(circle at 80% 70%, rgb(92 240 255 / 0.3), transparent 50%)",
            }}
          />
          <h2 className="display-lg relative mx-auto max-w-2xl">
            Your footage deserves a better edit.
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-fg-1">
            Spin up a project in under a minute. Bring any reference, drop any clips.
          </p>
          <Link
            href="/register"
            className="btn-primary relative mt-8 inline-flex px-7 py-3.5 text-base"
          >
            Start your first project <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="container-page border-t border-line-1/50 py-8 text-xs text-fg-2">
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="font-mono">© {new Date().getFullYear()} VisionCut AI</span>
          </div>
          <span className="font-mono">Reference-driven · explainable · transparent</span>
        </div>
      </footer>
    </div>
  );
}
