"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBytes } from "@/lib/utils";
import { CheckCircle2, X } from "lucide-react";

interface UploadProgressProps {
  projectId: string;
  file: File;
  onDone?: () => void;
  onCancel?: () => void;
}

export function UploadProgress({ projectId, file, onDone, onCancel }: UploadProgressProps) {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    try {
      await api.uploadFile({ projectId, kind: "clip", file, onProgress: setPct });
      setDone(true);
      onDone?.();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Upload failed");
    }
  };

  return (
    <div className="card flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="truncate font-medium">{file.name}</span>
          <span className="ml-2 flex-shrink-0 text-[rgb(var(--muted-foreground))]">
            {formatBytes(file.size)}
          </span>
        </div>
        <div className="mt-2">
          {done ? (
            <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--success))]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
            </div>
          ) : (
            <ProgressBar value={pct} showLabel />
          )}
          {error && <p className="mt-1 text-xs text-[rgb(var(--danger))]">{error}</p>}
        </div>
      </div>
      {!done && !error && pct === 0 && (
        <Button size="sm" onClick={start}>
          Start
        </Button>
      )}
      {(onCancel && !done) && (
        <button onClick={onCancel} className="text-[rgb(var(--muted-foreground))] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
