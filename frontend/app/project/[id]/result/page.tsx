"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });
  const quality = useQuery({
    queryKey: ["quality", projectId],
    queryFn: () => api.getQuality(projectId),
    enabled: project.data?.status === "done",
  });

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Final result</h1>
      <p className="mb-6 text-sm text-[rgb(var(--muted-foreground))]">
        {project.data?.status === "done"
          ? "Your video is ready. Download or rate the result."
          : "Render hasn't completed yet."}
      </p>

      {project.data?.status !== "done" ? (
        <Card>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Check the editor for live progress.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <video
              controls
              className="w-full rounded-lg border bg-black"
              src={api.renderDownloadUrl(projectId)}
            />
            <div className="mt-3 flex items-center justify-between">
              <a
                href={api.renderDownloadUrl(projectId)}
                download
                className="text-sm text-[rgb(var(--primary))] hover:underline"
              >
                Download MP4
              </a>
              {quality.data && (
                <Badge variant={quality.data.overall >= 80 ? "success" : "warning"}>
                  {quality.data.overall}% quality
                </Badge>
              )}
            </div>
          </Card>

          {quality.data && (
            <Card>
              <h3 className="mb-2 text-sm font-semibold">Quality report</h3>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <Score label="Pacing" value={quality.data.pacingMatch} />
                <Score label="Transitions" value={quality.data.transitionMatch} />
                <Score label="Audio" value={quality.data.audioMatch} />
                <Score label="Perceptual" value={quality.data.perceptualMatch} />
              </div>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-xs text-[rgb(var(--muted-foreground))]">{label}</div>
      <div className="text-lg font-semibold">
        {value != null ? value : "—"}
      </div>
    </div>
  );
}
