"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { TimelineViewer } from "@/components/timeline/TimelineViewer";
import { api } from "@/lib/api";

export default function TimelinePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const qc = useQueryClient();

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });
  const timeline = useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => api.getTimeline(projectId),
    enabled: !!project.data?.timeline,
  });

  const segments = timeline.data?.segments ?? [];
  const totalDuration = segments.reduce(
    (acc, s) => acc + (s.endTime - s.startTime),
    0
  );

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">{project.data?.name ?? "Timeline"}</h1>
      <p className="mb-6 text-sm text-[rgb(var(--muted-foreground))]">
        {segments.length} segment{segments.length === 1 ? "" : "s"} · inspect why each clip was chosen and swap alternatives.
      </p>
      <TimelineViewer
        segments={segments}
        totalDuration={totalDuration}
        projectId={projectId}
        onSwap={() => qc.invalidateQueries({ queryKey: ["timeline", projectId] })}
      />
    </AppShell>
  );
}
