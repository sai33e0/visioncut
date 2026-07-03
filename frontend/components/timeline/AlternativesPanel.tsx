"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import type { Segment } from "@/lib/types";

interface AlternativesPanelProps {
  projectId: string;
  segment: Segment;
  onSwap: (newClipId: string) => void;
}

export function AlternativesPanel({ projectId, segment, onSwap }: AlternativesPanelProps) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const swap = useMutation({
    mutationFn: (newClipId: string) => api.swapSegment(projectId, segment.id, newClipId),
    onSuccess: (_data, newClipId) => {
      onSwap(newClipId);
      qc.invalidateQueries({ queryKey: ["timeline", projectId] });
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Swap failed"),
  });

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <Repeat className="h-3.5 w-3.5 text-[rgb(var(--primary))]" />
        <h3 className="text-sm font-semibold">Alternatives</h3>
      </div>
      {segment.alternatives.length === 0 ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          No alternatives were generated for this segment.
        </p>
      ) : (
        <ul className="space-y-2">
          {segment.alternatives.map((a) => (
            <li
              key={a.clip_id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{a.name}</span>
                  <Badge
                    variant={
                      a.confidence >= 80
                        ? "success"
                        : a.confidence >= 60
                        ? "warning"
                        : "danger"
                    }
                  >
                    {a.confidence}%
                  </Badge>
                  <Badge
                    variant={
                      a.swap_impact === "low"
                        ? "success"
                        : a.swap_impact === "medium"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {a.swap_impact} impact
                  </Badge>
                </div>
                {a.matched && a.matched.length > 0 && (
                  <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                    Matched: {a.matched.join(", ")}
                  </p>
                )}
                {a.duration_sec != null && (
                  <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
                    Duration: {formatDuration(a.duration_sec)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={swap.isPending && swap.variables === a.clip_id}
                onClick={() => swap.mutate(a.clip_id)}
                disabled={swap.isPending}
              >
                Swap
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-[rgb(var(--danger))]">{error}</p>}
    </div>
  );
}
