"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FeedbackRating } from "@/lib/types";

interface ThumbsRatingProps {
  projectId: string;
  segmentId?: string;
  clipId?: string;
  initial?: FeedbackRating | null;
  onChange?: (rating: FeedbackRating | null) => void;
  size?: "sm" | "md";
}

export function ThumbsRating({
  projectId,
  segmentId,
  clipId,
  initial = null,
  onChange,
  size = "md",
}: ThumbsRatingProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(initial);

  const submit = useMutation({
    mutationFn: (r: FeedbackRating) =>
      api.submitFeedback({ projectId, segmentId, clipId, rating: r }),
  });

  const pick = (r: FeedbackRating) => {
    const next = rating === r ? null : r;
    setRating(next);
    onChange?.(next);
    if (next) submit.mutate(next);
  };

  const sz = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => pick("up")}
        aria-label="Thumbs up"
        className={cn(
          sz,
          "inline-flex items-center justify-center rounded-md border transition-colors",
          rating === "up"
            ? "border-[rgb(var(--success))] bg-[rgb(var(--success))]/15 text-[rgb(var(--success))]"
            : "border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--success))]/50 hover:text-[rgb(var(--success))]"
        )}
      >
        <ThumbsUp className={icon} />
      </button>
      <button
        onClick={() => pick("down")}
        aria-label="Thumbs down"
        className={cn(
          sz,
          "inline-flex items-center justify-center rounded-md border transition-colors",
          rating === "down"
            ? "border-[rgb(var(--danger))] bg-[rgb(var(--danger))]/15 text-[rgb(var(--danger))]"
            : "border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--danger))]/50 hover:text-[rgb(var(--danger))]"
        )}
      >
        <ThumbsDown className={icon} />
      </button>
    </div>
  );
}
