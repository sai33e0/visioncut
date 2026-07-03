"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { FeedbackRating } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FeedbackBadge({
  rating,
  className,
}: {
  rating: FeedbackRating;
  className?: string;
}) {
  if (rating === "up") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-[rgb(var(--success))]/40 bg-[rgb(var(--success))]/10 px-2 py-0.5 text-xs text-[rgb(var(--success))]",
          className
        )}
      >
        <ThumbsUp className="h-3 w-3" /> Liked
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[rgb(var(--danger))]/40 bg-[rgb(var(--danger))]/10 px-2 py-0.5 text-xs text-[rgb(var(--danger))]",
        className
      )}
    >
      <ThumbsDown className="h-3 w-3" /> Disliked
    </span>
  );
}
