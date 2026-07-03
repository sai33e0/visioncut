"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { ExplainPanel } from "@/components/timeline/ExplainPanel";
import { api } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";

export default function ExplainPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const timeline = useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => api.getTimeline(projectId),
  });
  const segments = timeline.data?.segments ?? [];
  const active = segments.find((s) => s.id === selectedId) ?? segments[0];

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Explain</h1>
      <p className="mb-6 text-sm text-[rgb(var(--muted-foreground))]">
        Click a segment to see why it was chosen — and the alternatives you could swap in.
      </p>

      {segments.length === 0 ? (
        <Card className="text-sm text-[rgb(var(--muted-foreground))]">
          No segments built yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-1.5">
            {segments.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  (active?.id === s.id)
                    ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10"
                    : "border-[rgb(var(--border))] hover:bg-[rgb(var(--accent))]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Segment #{s.position}</span>
                  <span className="text-xs text-[rgb(var(--muted-foreground))]">
                    {Math.round(s.confidence)}%
                  </span>
                </div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">
                  {formatDuration(s.endTime - s.startTime)}
                </div>
              </button>
            ))}
          </div>
          {active && <ExplainPanel projectId={projectId} segmentId={active.id} />}
        </div>
      )}
    </AppShell>
  );
}
