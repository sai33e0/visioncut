"use client";

import { CheckCircle2, AlertTriangle, Lightbulb, Music, Mic, Volume2, Film } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Blueprint, Clip } from "@/lib/types";

interface Gap {
  type: "music" | "voiceover" | "sfx" | "clip";
  required: boolean;
  reason: string;
  suggestion?: string;
}

interface GapAnalysisCardProps {
  blueprint: Blueprint | null;
  clips: Clip[];
}

export function GapAnalysisCard({ blueprint, clips }: GapAnalysisCardProps) {
  if (!blueprint) {
    return (
      <div className="card text-sm text-[rgb(var(--muted-foreground))]">
        Gap analysis will appear once a blueprint is generated.
      </div>
    );
  }
  const gaps: Gap[] = computeGaps(blueprint, clips);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Gap analysis</h3>
        <Badge variant={gaps.length === 0 ? "success" : "warning"}>
          {gaps.length === 0 ? "All assets present" : `${gaps.length} item${gaps.length === 1 ? "" : "s"} to fill`}
        </Badge>
      </div>
      {gaps.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted-foreground))]">
          <CheckCircle2 className="h-4 w-4 text-[rgb(var(--success))]" />
          You have everything needed to build the edit.
        </div>
      ) : (
        <ul className="space-y-2">
          {gaps.map((g, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <div className="mt-0.5">
                {g.type === "music" && <Music className="h-4 w-4 text-[rgb(var(--primary))]" />}
                {g.type === "voiceover" && <Mic className="h-4 w-4 text-[rgb(var(--primary))]" />}
                {g.type === "sfx" && <Volume2 className="h-4 w-4 text-[rgb(var(--primary))]" />}
                {g.type === "clip" && <Film className="h-4 w-4 text-[rgb(var(--primary))]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{g.type}</span>
                  {g.required && <Badge variant="warning">Required</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">{g.reason}</p>
                {g.suggestion && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[rgb(var(--primary))]">
                    <Lightbulb className="h-3 w-3" />
                    {g.suggestion}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function computeGaps(blueprint: Blueprint, clips: Clip[]): Gap[] {
  const gaps: Gap[] = [];
  const has = (type: string) => clips.some((c) => c.type === type);
  const userClipCount = clips.filter((c) => c.type === "user").length;

  if (userClipCount < 3) {
    gaps.push({
      type: "clip",
      required: true,
      reason: `Only ${userClipCount} user clip${userClipCount === 1 ? "" : "s"} uploaded. More footage gives the matcher better alternatives.`,
      suggestion: "Upload 5–10 varied clips for best results.",
    });
  }

  if (blueprint.audio?.has_music && !has("music")) {
    gaps.push({
      type: "music",
      required: true,
      reason: `Blueprint expects music (${blueprint.audio.music_type ?? "any"}).`,
      suggestion: "Upload a royalty-free track with the same tempo.",
    });
  }
  if (blueprint.audio?.has_voiceover && !has("voiceover")) {
    gaps.push({
      type: "voiceover",
      required: blueprint.audio.has_voiceover,
      reason: "Reference includes spoken voiceover.",
      suggestion: "Record or upload narration that fits the target language.",
    });
  }
  if (blueprint.audio?.has_sfx && !has("sfx")) {
    gaps.push({
      type: "sfx",
      required: false,
      reason: "Reference uses sound effects for emphasis.",
      suggestion: "Optional — a few SFX packs will sharpen the edit.",
    });
  }
  return gaps;
}
