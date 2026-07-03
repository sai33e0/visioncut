"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Lock, Globe, Library } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BlueprintCard } from "@/components/analysis/BlueprintCard";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function StyleDetailPage() {
  const params = useParams<{ id: string }>();
  const styleId = params.id;

  const { data: style, isLoading } = useQuery({
    queryKey: ["style", styleId],
    queryFn: () => api.getStyle(styleId),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="text-sm text-[rgb(var(--muted-foreground))]">Loading…</div>
      </AppShell>
    );
  }
  if (!style) {
    return (
      <AppShell>
        <div className="text-sm text-[rgb(var(--danger))]">Style not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        href="/styles"
        className="mb-3 inline-flex items-center gap-1 text-xs text-[rgb(var(--muted-foreground))] hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to styles
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{style.name}</h1>
          {style.description && (
            <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
              {style.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={style.isPublic ? "primary" : "default"}>
              {style.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {style.isPublic ? "public" : "private"}
            </Badge>
            {style.contentType && <Badge>{style.contentType}</Badge>}
            {style.pace && <Badge variant="primary">{style.pace}</Badge>}
          </div>
        </div>
        <div className="text-right text-xs text-[rgb(var(--muted-foreground))]">
          <div className="flex items-center gap-1">
            <Library className="h-3 w-3" /> Used {style.usageCount}×
          </div>
          <div className="mt-1">{formatDate(style.createdAt)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BlueprintCard blueprint={(style as any).blueprintTemplate ?? null} />
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[rgb(var(--primary))]" /> Style vector
          </h3>
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            This 256-dim embedding powers content-based style matching. Similar
            blueprints land near each other in vector space, so the matcher can
            find related styles without explicit tags.
          </p>
          <div className="mt-3 grid grid-cols-16 gap-0.5">
            {Array.from({ length: 64 }).map((_, i) => {
              const intensity = ((style as any).styleVector?.[i] ?? 0) * 0.5 + 0.5;
              return (
                <div
                  key={i}
                  className="h-3 rounded-sm"
                  style={{ background: `rgba(124,92,255,${intensity.toFixed(2)})` }}
                />
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-[rgb(var(--muted-foreground))]">
            Showing first 64 of 256 dimensions.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
