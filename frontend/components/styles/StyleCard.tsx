"use client";

import Link from "next/link";
import { Library, Globe, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Style } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface StyleCardProps {
  style: Style;
  onApply?: (style: Style) => void;
}

export function StyleCard({ style, onApply }: StyleCardProps) {
  return (
    <div className="card card-hover">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{style.name}</h3>
          {style.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[rgb(var(--muted-foreground))]">
              {style.description}
            </p>
          )}
        </div>
        <Badge variant={style.isPublic ? "primary" : "default"}>
          {style.isPublic ? (
            <>
              <Globe className="h-3 w-3" /> public
            </>
          ) : (
            <>
              <Lock className="h-3 w-3" /> private
            </>
          )}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {style.contentType && <Badge>{style.contentType}</Badge>}
        {style.pace && <Badge variant="primary">{style.pace}</Badge>}
        {typeof style.similarity === "number" && (
          <Badge variant="success">{style.similarity.toFixed(0)}% match</Badge>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))]">
        <span>
          <Library className="mr-1 inline h-3 w-3" />
          Used {style.usageCount}× · {formatDate(style.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={() => onApply(style)}
              className="text-[rgb(var(--primary))] hover:underline"
            >
              <Sparkles className="mr-0.5 inline h-3 w-3" /> Apply
            </button>
          )}
          <Link href={`/styles/${style.id}`} className="hover:underline">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
