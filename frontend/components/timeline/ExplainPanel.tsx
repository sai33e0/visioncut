"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ExplainPanelProps {
  projectId: string;
  segmentId: string;
}

export function ExplainPanel({ projectId, segmentId }: ExplainPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["explain", projectId, segmentId],
    queryFn: () => api.explainSegment(projectId, segmentId),
  });

  if (isLoading) {
    return <Card className="animate-pulse text-sm text-[rgb(var(--muted-foreground))]">Loading…</Card>;
  }
  if (error || !data) {
    return <Card className="text-sm text-[rgb(var(--danger))]">Could not load explanation.</Card>;
  }

  const reason = data.reason ?? {};
  const selected = data.selectedClip;

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Why this clip?</h3>
          {selected && (
            <Badge variant={selected.confidence >= 80 ? "success" : "warning"}>
              {selected.confidence}% match
            </Badge>
          )}
        </div>
        {selected ? (
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Selected</div>
              <div className="font-medium">{selected.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <List label="Matched" items={selected.matched ?? []} tone="success" />
              <List label="Not matched" items={selected.notMatched ?? []} tone="danger" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">No clip selected yet.</p>
        )}
      </div>

      <div className="card text-xs">
        <div className="label">Score breakdown</div>
        {Object.keys(reason.raw_scores ?? {}).length > 0 ? (
          <ul className="space-y-1">
            {Object.entries(reason.raw_scores).map(([k, v]: [string, any]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="w-32 text-[rgb(var(--muted-foreground))]">
                  {k.replace(/_/g, " ")}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-[rgb(var(--accent))]">
                  <div
                    className="h-full bg-[rgb(var(--primary))]"
                    style={{ width: `${Math.round(Number(v) * 100)}%`, opacity: Number(v) < 0.4 ? 0.4 : 1 }}
                  />
                </div>
                <span className="w-10 text-right font-mono">{Math.round(Number(v) * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[rgb(var(--muted-foreground))]">
            <HelpCircle className="mr-1 inline h-3.5 w-3.5" />
            Score details not stored for this segment.
          </p>
        )}
      </div>
    </div>
  );
}

function List({ label, items, tone }: { label: string; items: string[]; tone: "success" | "danger" }) {
  const Icon = tone === "success" ? CheckCircle2 : XCircle;
  const cls = tone === "success" ? "text-[rgb(var(--success))]" : "text-[rgb(var(--danger))]";
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
        {label}
      </div>
      {items.length === 0 ? (
        <span className="text-[rgb(var(--muted-foreground))]">—</span>
      ) : (
        <ul className="space-y-0.5">
          {items.map((i) => (
            <li key={i} className={`flex items-center gap-1 ${cls}`}>
              <Icon className="h-3.5 w-3.5" /> {i.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
