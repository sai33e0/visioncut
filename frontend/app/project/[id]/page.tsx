"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Play,
  RefreshCw,
  Save,
  ArrowRight,
  Film,
  BarChart3,
  Layers,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BlueprintCard } from "@/components/analysis/BlueprintCard";
import { GapAnalysisCard } from "@/components/analysis/GapAnalysisCard";
import { LiveEditingLog } from "@/components/analysis/LiveEditingLog";
import { TimelineViewer } from "@/components/timeline/TimelineViewer";
import { api } from "@/lib/api";
import { cn, statusColor, statusLabel } from "@/lib/utils";

type Tab = "overview" | "timeline" | "explain" | "result";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [styleName, setStyleName] = useState("");
  const [savingStyle, setSavingStyle] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "failed" ? false : 3000;
    },
  });

  const timeline = useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => api.getTimeline(projectId),
    enabled: !!project?.timeline,
  });

  const render = useMutation({
    mutationFn: () => api.startRender(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      setTab("result");
    },
  });

  const saveStyle = useMutation({
    mutationFn: () =>
      api.saveStyle({ name: styleName, projectId, isPublic: false }),
    onSuccess: () => {
      setSavingStyle(false);
      setStyleName("");
      qc.invalidateQueries({ queryKey: ["styles", "mine"] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="text-sm text-[rgb(var(--muted-foreground))]">Loading…</div>
      </AppShell>
    );
  }
  if (!project) {
    return (
      <AppShell>
        <div className="text-sm text-[rgb(var(--danger))]">Project not found.</div>
      </AppShell>
    );
  }

  const totalDuration = (timeline.data?.segments ?? []).reduce(
    (acc, s) => acc + (s.endTime - s.startTime),
    0
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-[rgb(var(--muted-foreground))] hover:underline"
          >
            ← Back to dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("badge border", statusColor(project.status))}>
            {statusLabel(project.status)}
          </span>
          {project.qualityScore != null && (
            <Badge variant="success">{project.qualityScore.toFixed(0)}% quality</Badge>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border p-1">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          <Sparkles className="h-3.5 w-3.5" /> Overview
        </TabButton>
        <TabButton
          active={tab === "timeline"}
          onClick={() => setTab("timeline")}
          disabled={!project.timeline}
        >
          <Layers className="h-3.5 w-3.5" /> Timeline
        </TabButton>
        <TabButton active={tab === "result"} onClick={() => setTab("result")}>
          <Play className="h-3.5 w-3.5" /> Result
        </TabButton>
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BlueprintCard blueprint={project.blueprint} />
            <LiveEditingLog projectId={projectId} />
          </div>

          <GapAnalysisCard blueprint={project.blueprint} clips={project.clips ?? []} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              {project.status === "analyzing" || project.status === "building" ? (
                <span className="flex items-center gap-1.5 text-[rgb(var(--warning))]">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {project.currentStep ?? "Working…"} ({project.progress}%)
                </span>
              ) : project.status === "done" ? (
                <span className="text-[rgb(var(--success))]">Render complete</span>
              ) : project.status === "failed" ? (
                <span className="text-[rgb(var(--danger))]">
                  {project.errorMessage ?? "Failed"}
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              {project.status === "uploading" && (
                <Button
                  onClick={() => api.startAnalysis(projectId)}
                  size="lg"
                >
                  <Sparkles className="h-4 w-4" /> Start analysis
                </Button>
              )}
              {project.timeline && project.status !== "rendering" && project.status !== "done" && (
                <Button onClick={() => render.mutate()} loading={render.isPending} size="lg">
                  <Play className="h-4 w-4" /> Render
                </Button>
              )}
            </div>
          </div>

          {project.status === "done" && (
            <Card>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Save className="h-4 w-4 text-[rgb(var(--primary))]" /> Save as style
              </div>
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Save this project's editing style to your library. You can re-apply it
                to any future project without needing the reference video.
              </p>
              {savingStyle ? (
                <div className="flex gap-2">
                  <input
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    placeholder="Style name (e.g. Travel Reel v1)"
                    className="input"
                  />
                  <Button
                    onClick={() => saveStyle.mutate()}
                    loading={saveStyle.isPending}
                    disabled={styleName.length < 3}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setSavingStyle(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setSavingStyle(true)}>
                  <Save className="h-4 w-4" /> Save style
                </Button>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <TimelineViewer
          segments={timeline.data?.segments ?? []}
          totalDuration={totalDuration}
          projectId={projectId}
          onSwap={() => qc.invalidateQueries({ queryKey: ["timeline", projectId] })}
        />
      )}

      {tab === "result" && (
        <ResultPanel projectId={projectId} status={project.status} />
      )}
    </AppShell>
  );
}

function ResultPanel({ projectId, status }: { projectId: string; status: string }) {
  const quality = useQuery({
    queryKey: ["quality", projectId],
    queryFn: () => api.getQuality(projectId),
    enabled: status === "done",
  });
  const timeline = useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => api.getTimeline(projectId),
  });
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const seg = (timeline.data?.segments ?? []).find((s) => s.id === selectedSegId) ?? null;

  if (status === "rendering" || status === "analyzing" || status === "building") {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Your video is still being processed. Refresh the page in a minute.
        </p>
      </Card>
    );
  }
  if (status === "failed") {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--danger))]">
          Render failed. Check the log on the Overview tab for details.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Final render</h3>
          {quality.data && (
            <Badge variant={quality.data.overall >= 80 ? "success" : "warning"}>
              {quality.data.overall}% overall
            </Badge>
          )}
        </div>
        <video
          controls
          className="w-full rounded-lg border bg-black"
          src={api.renderDownloadUrl(projectId)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <a
            href={api.renderDownloadUrl(projectId)}
            download
            className="text-[rgb(var(--primary))] hover:underline"
          >
            Download MP4
          </a>
          {quality.data && (
            <div className="flex flex-wrap gap-3 text-[rgb(var(--muted-foreground))]">
              <span>Pacing: {quality.data.pacingMatch}</span>
              <span>Transitions: {quality.data.transitionMatch}</span>
              {quality.data.audioMatch != null && <span>Audio: {quality.data.audioMatch}</span>}
              {quality.data.perceptualMatch != null && (
                <span>Perceptual: {quality.data.perceptualMatch}</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {timeline.data && timeline.data.segments.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Rate your segments</h3>
          <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
            Thumbs up the selections you liked — VisionCut learns your preferences for next time.
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {timeline.data.segments.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSegId(s.id)}
                className={cn(
                  "flex items-center justify-between rounded-md border p-2 text-left text-xs",
                  selectedSegId === s.id
                    ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10"
                    : "border-[rgb(var(--border))]"
                )}
              >
                <span>#{s.position}</span>
                <SegmentThumbs projectId={projectId} segmentId={s.id} clipId={s.clipId ?? undefined} />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SegmentThumbs({
  projectId,
  segmentId,
  clipId,
}: {
  projectId: string;
  segmentId: string;
  clipId?: string;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const submit = useMutation({
    mutationFn: (r: "up" | "down") =>
      api.submitFeedback({ projectId, segmentId, clipId, rating: r }),
    onSuccess: (_, r) => setRating(r),
  });
  return (
    <div className="flex gap-1">
      <button
        onClick={() => submit.mutate("up")}
        className={cn(
          "rounded px-1.5 py-0.5 text-xs",
          rating === "up" ? "bg-[rgb(var(--success))]/20 text-[rgb(var(--success))]" : "text-[rgb(var(--muted-foreground))] hover:text-white"
        )}
      >
        👍
      </button>
      <button
        onClick={() => submit.mutate("down")}
        className={cn(
          "rounded px-1.5 py-0.5 text-xs",
          rating === "down" ? "bg-[rgb(var(--danger))]/20 text-[rgb(var(--danger))]" : "text-[rgb(var(--muted-foreground))] hover:text-white"
        )}
      >
        👎
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
        active
          ? "bg-[rgb(var(--accent))] text-white"
          : "text-[rgb(var(--muted-foreground))] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
