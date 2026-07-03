"use client";

import { useState } from "react";
import { TimelineSegment, SegmentDetail } from "./TimelineSegment";
import { AlternativesPanel } from "./AlternativesPanel";
import type { Segment } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface TimelineViewerProps {
  segments: Segment[];
  totalDuration: number;
  projectId: string;
  onSwap?: (segmentId: string, newClipId: string) => void;
}

export function TimelineViewer({
  segments,
  totalDuration,
  projectId,
  onSwap,
}: TimelineViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(segments[0]?.id ?? null);
  const selected = segments.find((s) => s.id === selectedId) ?? null;

  if (segments.length === 0) {
    return (
      <div className="card text-sm text-[rgb(var(--muted-foreground))]">
        Timeline is empty.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-3 flex items-center justify-between text-xs">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <span className="text-[rgb(var(--muted-foreground))]">
            {segments.length} segments · {formatDuration(totalDuration)}
          </span>
        </div>
        <div className="relative h-16 w-full overflow-x-auto rounded bg-[rgb(var(--background))]">
          {segments.map((seg) => (
            <TimelineSegment
              key={seg.id}
              segment={seg}
              totalDuration={totalDuration}
              selected={seg.id === selectedId}
              onSelect={() => setSelectedId(seg.id)}
              onExplain={() => {}}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {selected ? (
          <SegmentDetail segment={selected} />
        ) : (
          <div className="card text-sm text-[rgb(var(--muted-foreground))]">
            Select a segment to see why it was chosen.
          </div>
        )}
        {selected && (
          <AlternativesPanel
            projectId={projectId}
            segment={selected}
            onSwap={(newClipId) => {
              onSwap?.(selected.id, newClipId);
            }}
          />
        )}
      </div>
    </div>
  );
}
