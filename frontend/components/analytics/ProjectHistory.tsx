"use client";

import Link from "next/link";
import { Film, ListChecks, Sparkles, ArrowRight } from "lucide-react";
import type { ProjectHistoryEntry } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatDate, statusColor, statusLabel } from "@/lib/utils";

export function ProjectHistory({ data }: { data: ProjectHistoryEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="card text-sm text-[rgb(var(--muted-foreground))]">
        No projects yet. Create your first one from the dashboard.
      </div>
    );
  }
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b bg-[rgb(var(--accent))] text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Clips</th>
            <th className="px-3 py-2 text-left">Segments</th>
            <th className="px-3 py-2 text-left">Quality</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-[rgb(var(--accent))]/40">
              <td className="px-3 py-2 font-medium">{p.name}</td>
              <td className="px-3 py-2">
                <span className={`badge border ${statusColor(p.status)}`}>
                  {statusLabel(p.status)}
                </span>
              </td>
              <td className="px-3 py-2 text-[rgb(var(--muted-foreground))]">
                <Film className="mr-1 inline h-3 w-3" />
                {p._count.clips}
              </td>
              <td className="px-3 py-2 text-[rgb(var(--muted-foreground))]">
                <ListChecks className="mr-1 inline h-3 w-3" />
                {p._count.segments}
              </td>
              <td className="px-3 py-2">
                {p.qualityScore != null ? (
                  <Badge variant={p.qualityScore >= 80 ? "success" : "warning"}>
                    <Sparkles className="h-3 w-3" /> {p.qualityScore.toFixed(0)}
                  </Badge>
                ) : (
                  <span className="text-xs text-[rgb(var(--muted-foreground))]">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-[rgb(var(--muted-foreground))]">
                {formatDate(p.createdAt)}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/project/${p.id}`}
                  className="inline-flex items-center gap-1 text-xs text-[rgb(var(--primary))] hover:underline"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
