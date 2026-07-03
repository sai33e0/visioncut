"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { PacingStats } from "@/components/analytics/PacingStats";
import { TransitionChart } from "@/components/analytics/TransitionChart";
import { ProjectHistory } from "@/components/analytics/ProjectHistory";
import { ThumbsUp, ThumbsDown, Activity } from "lucide-react";
import { api } from "@/lib/api";

export default function AnalyticsPage() {
  const summary = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => api.getAnalyticsSummary(),
  });
  const transitions = useQuery({
    queryKey: ["analytics", "transitions"],
    queryFn: () => api.getTransitionStats(),
  });
  const history = useQuery({
    queryKey: ["analytics", "history"],
    queryFn: () => api.getProjectHistory(50),
  });
  const quality = useQuery({
    queryKey: ["analytics", "quality"],
    queryFn: () => api.getQualityOverTime(),
  });
  const mix = useQuery({
    queryKey: ["analytics", "mix"],
    queryFn: () => api.getContentMix(),
  });
  const accuracy = useQuery({
    queryKey: ["analytics", "accuracy"],
    queryFn: () => api.getFeedbackAccuracy(),
  });

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiCard
          label="Projects completed"
          value={summary.data?.projectsCompleted ?? 0}
          loading={summary.isLoading}
        />
        <KpiCard
          label="Avg quality"
          value={summary.data?.avgQualityScore != null ? `${summary.data.avgQualityScore.toFixed(1)}%` : "—"}
          loading={summary.isLoading}
        />
        <KpiCard
          label="Best style"
          value={summary.data?.bestStyle ?? "—"}
          loading={summary.isLoading}
        />
        <KpiCard
          label="Feedback accuracy"
          value={
            accuracy.data?.accuracy != null
              ? `${accuracy.data.accuracy}%`
              : "—"
          }
          sub={
            accuracy.data
              ? `${accuracy.data.up} up · ${accuracy.data.down} down`
              : undefined
          }
          loading={accuracy.isLoading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PacingStats data={quality.data ?? []} />
        <TransitionChart data={transitions.data ?? []} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-[rgb(var(--primary))]" /> Content mix
          </div>
          {mix.data && mix.data.contentTypes.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {mix.data.contentTypes.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-[rgb(var(--muted-foreground))]">{c.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">No data yet.</p>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-[rgb(var(--primary))]" /> Pace distribution
          </div>
          {mix.data && mix.data.paces.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {mix.data.paces.map((p) => (
                <li key={p.name} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-[rgb(var(--muted-foreground))]">{p.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">No data yet.</p>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ThumbsUp className="h-4 w-4 text-[rgb(var(--success))]" />
            <ThumbsDown className="h-4 w-4 text-[rgb(var(--danger))]" /> Feedback
          </div>
          {accuracy.data && accuracy.data.total > 0 ? (
            <ul className="space-y-1 text-xs">
              <li className="flex justify-between text-[rgb(var(--success))]">
                <span>Thumbs up</span>
                <span>{accuracy.data.up}</span>
              </li>
              <li className="flex justify-between text-[rgb(var(--danger))]">
                <span>Thumbs down</span>
                <span>{accuracy.data.down}</span>
              </li>
              <li className="flex justify-between border-t pt-1 font-medium">
                <span>Accuracy</span>
                <span>{accuracy.data.accuracy}%</span>
              </li>
            </ul>
          ) : (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Rate some segments to see your personalization accuracy.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Project history</h2>
        <ProjectHistory data={history.data ?? []} />
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <div className="mb-1 text-xs text-[rgb(var(--muted-foreground))]">{label}</div>
      <div className="text-2xl font-semibold">{loading ? "…" : value}</div>
      {sub && <div className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">{sub}</div>}
    </Card>
  );
}
