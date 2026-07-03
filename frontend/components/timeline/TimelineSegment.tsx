"use client";

import { CheckCircle2, XCircle, ArrowRight, Film } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDuration } from "@/lib/utils";
import type { Segment } from "@/lib/types";

interface TimelineSegmentProps {
  segment: Segment;
  totalDuration: number;
  selected: boolean;
  onSelect: () => void;
  onExplain: () => void;
}

export function TimelineSegment({
  segment,
  totalDuration,
  selected,
  onSelect,
  onExplain,
}: TimelineSegmentProps) {
  const startPct = totalDuration > 0 ? (segment.startTime / totalDuration) * 100 : 0;
  const widthPct = totalDuration > 0
    ? Math.max(2, ((segment.endTime - segment.startTime) / totalDuration) * 100)
    : 0;
  const confidence = Math.round(segment.confidence);

  return (
    <button
      onClick={() => {
        onSelect();
        onExplain();
      }}
      className={cn(
        "group relative flex h-16 flex-col justify-between rounded-md border p-1.5 text-left transition-colors",
        selected
          ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10"
          : "border-[rgb(var(--border))] bg-[rgb(var(--accent))] hover:border-[rgb(var(--primary))]/50"
      )}
      style={{ marginLeft: `${startPct}%`, width: `${widthPct}%`, minWidth: 80 }}
    >
      <div className="flex items-center gap-1 truncate text-[10px] uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
        <Film className="h-3 w-3" /> #{segment.position}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium">
          {formatDuration(segment.endTime - segment.startTime)}
        </span>
        <Badge
          variant={confidence >= 80 ? "success" : confidence >= 60 ? "warning" : "danger"}
        >
          {confidence}%
        </Badge>
      </div>
      {segment.transition && segment.transition !== "cut" && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 rounded bg-[rgb(var(--primary))] px-1 text-[9px] text-white">
          {segment.transition}
        </div>
      )}
    </button>
  );
}

export function SegmentDetail({ segment }: { segment: Segment }) {
  const reason = segment.matchReason;
  return (
    <div className="card space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Segment #{segment.position}</h4>
        <Badge>
          {formatDuration(segment.startTime)} → {formatDuration(segment.endTime)}
        </Badge>
      </div>

      {reason && (
        <div>
          <div className="label">Why this clip</div>
          <ul className="space-y-1 text-xs">
            {reason.matched?.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-[rgb(var(--success))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> {labelFor(m)}
              </li>
            ))}
            {reason.not_matched?.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-[rgb(var(--danger))]">
                <XCircle className="h-3.5 w-3.5" /> {labelFor(m)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reason?.raw_scores && (
        <div>
          <div className="label">Raw scores</div>
          <div className="space-y-1">
            {Object.entries(reason.raw_scores).map(([k, v]) => (
              <ScoreBar key={k} label={labelFor(k)} value={v} />
            ))}
          </div>
        </div>
      )}

      {segment.alternatives && segment.alternatives.length > 0 && (
        <div>
          <div className="label">Alternatives</div>
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            Click a row in the Alternatives panel to swap.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))]">
        <span>Scene: {reason?.scene_type ?? "—"}</span>
        <span>Camera: {reason?.camera_movement ?? "—"}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-[rgb(var(--accent))]">
        <div
          className="h-full bg-[rgb(var(--primary))]"
          style={{ width: `${pct}%`, opacity: pct < 40 ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
}

function labelFor(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
