"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Sparkles, Film, CheckCircle2, AlertCircle, Clock, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { formatDate, statusColor, statusLabel } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { easeOut, fadeUp, stagger } from "@/lib/motion";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
  });
  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => api.getAnalyticsSummary(),
  });

  return (
    <AppShell>
      <motion.div
        initial="hidden"
        animate="show"
        variants={stagger(0.06)}
      >
        <motion.div variants={fadeUp} className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label">// dashboard</span>
            <h1 className="display-md mt-2">
              Welcome{user?.displayName ? `, ${user.displayName}` : ""}
            </h1>
            <p className="mt-2 text-sm text-fg-2">
              Start a new project or pick one up where you left off.
            </p>
          </div>
          <Link href="/project/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New project <ArrowUpRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={stagger(0.08)}
          className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          <Stat
            icon={<Film className="h-4 w-4" />}
            label="Completed"
            value={summary?.projectsCompleted ?? 0}
            accent="violet"
          />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label="Avg quality"
            value={summary?.avgQualityScore != null ? `${summary.avgQualityScore.toFixed(0)}%` : "—"}
            accent="cyan"
          />
          <Stat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Clips processed"
            value={summary?.totalClipsProcessed ?? 0}
            accent="magenta"
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Credits left"
            value={user?.credits ?? 0}
            accent="amber"
          />
        </motion.div>

        <motion.div variants={fadeUp} className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Your projects</h2>
          {projects && projects.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-fg-3">
              {projects.length} total
            </span>
          )}
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card h-40 animate-shimmer" />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-4 py-16 text-center">
            <div
              className="h-16 w-16 rounded-2xl"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgb(124 92 255), transparent 60%), radial-gradient(circle at 70% 70%, rgb(92 240 255), transparent 60%)",
              }}
            />
            <div>
              <p className="font-display text-lg">No projects yet</p>
              <p className="mt-1 text-sm text-fg-2">Drop a reference, get a finished cut.</p>
            </div>
            <Link href="/project/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Create your first project
            </Link>
          </div>
        ) : (
          <motion.div
            variants={stagger(0.05)}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
          >
            {projects.map((p) => (
              <motion.div key={p.id} variants={fadeUp}>
                <Link
                  href={`/project/${p.id}`}
                  className="glass-card group block overflow-hidden p-0"
                >
                  <div
                    className="relative h-32 overflow-hidden"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, rgb(124 92 255 / 0.4), transparent 60%), radial-gradient(circle at 70% 70%, rgb(92 240 255 / 0.3), transparent 60%)",
                    }}
                  >
                    <div className="absolute inset-0 bg-bg-0/40" />
                    <div className="absolute bottom-2 right-2">
                      <span className={`chip ${statusColor(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    <div className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-widest text-fg-1">
                      {p.id.slice(0, 8)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-display text-sm font-semibold">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-fg-2">{p.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-fg-3">{formatDate(p.createdAt)}</span>
                      {p.qualityScore != null && (
                        <span
                          className={
                            p.qualityScore >= 80
                              ? "chip chip-success text-[10px]"
                              : "chip chip-cyan text-[10px]"
                          }
                        >
                          {p.qualityScore.toFixed(0)}% match
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: "violet" | "cyan" | "magenta" | "amber";
}) {
  const accentColor = `rgb(var(--${accent}))`;
  return (
    <motion.div
      variants={fadeUp}
      className="glass-card relative overflow-hidden p-4"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl"
        style={{ background: accentColor }}
      />
      <div className="relative">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-fg-2">
          <span style={{ color: accentColor }}>{icon}</span>
          {label}
        </div>
        <div className="font-display text-3xl font-semibold">{value}</div>
      </div>
    </motion.div>
  );
}
