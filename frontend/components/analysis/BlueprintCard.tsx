"use client";

import { Badge } from "@/components/ui/Badge";
import { Music, Mic, Activity, Palette, Film, Clock, Gauge } from "lucide-react";
import type { Blueprint } from "@/lib/types";

export function BlueprintCard({ blueprint }: { blueprint: Blueprint | null }) {
  if (!blueprint) {
    return (
      <div className="card text-sm text-[rgb(var(--muted-foreground))]">
        No blueprint yet. Start the analysis pipeline to generate one.
      </div>
    );
  }

  const a = blueprint.audio ?? {};
  const transitionTypes = (blueprint.transitions ?? []).map((t) => t.type);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Blueprint</h3>
        <Badge variant={blueprint.confidence >= 0.7 ? "success" : "warning"}>
          {Math.round(blueprint.confidence * 100)}% confidence
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat icon={<Film className="h-3.5 w-3.5" />} label="Content type" value={blueprint.content_type} />
        <Stat icon={<Gauge className="h-3.5 w-3.5" />} label="Pace" value={blueprint.pace} />
        <Stat
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Avg clip"
          value={`${blueprint.avg_clip_duration.toFixed(2)}s`}
        />
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Total cuts" value={blueprint.total_cuts} />
      </div>

      <div>
        <div className="label">Transitions detected</div>
        <div className="flex flex-wrap gap-1.5">
          {transitionTypes.length === 0 ? (
            <span className="text-xs text-[rgb(var(--muted-foreground))]">—</span>
          ) : (
            transitionTypes.map((t) => <Badge key={t}>{t}</Badge>)
          )}
        </div>
      </div>

      <div>
        <div className="label">Audio</div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {a.has_music && (
            <Badge variant="primary">
              <Music className="h-3 w-3" /> music · {a.music_type}
            </Badge>
          )}
          {a.has_voiceover && (
            <Badge variant="primary">
              <Mic className="h-3 w-3" /> voiceover
            </Badge>
          )}
          {a.has_dialogue && <Badge>dialogue</Badge>}
          {a.has_sfx && <Badge>sfx</Badge>}
          {a.beat_sync && <Badge variant="success">{a.tempo_bpm.toFixed(0)} BPM · beat sync</Badge>}
          {!a.has_music && !a.has_voiceover && !a.has_dialogue && !a.has_sfx && (
            <span className="text-[rgb(var(--muted-foreground))]">—</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat icon={<Palette className="h-3.5 w-3.5" />} label="Color grade" value={blueprint.color_grade} />
        <Stat label="Effects" value={(blueprint.visual_effects ?? []).join(", ") || "—"} />
        <Stat
          label="Required clip types"
          value={(blueprint.required_clip_types ?? []).join(", ") || "any"}
        />
        <Stat label="Language" value={blueprint.language} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
        {icon}
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
