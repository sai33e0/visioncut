"use client";

import { useState } from "react";
import { Music, Mic, Volume2, FileAudio, X, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, formatBytes } from "@/lib/utils";

type AssetKind = "music" | "sfx" | "voiceover";

interface AssetUploaderProps {
  projectId: string;
  kind: AssetKind;
  label: string;
  icon?: React.ReactNode;
  accept?: string;
  onUploaded?: () => void;
}

const iconFor: Record<AssetKind, React.ReactNode> = {
  music: <Music className="h-4 w-4" />,
  sfx: <Volume2 className="h-4 w-4" />,
  voiceover: <Mic className="h-4 w-4" />,
};

export function AssetUploader({
  projectId,
  kind,
  label,
  icon,
  accept = "audio/mpeg,audio/wav,audio/aac",
  onUploaded,
}: AssetUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
    setDone(false);
    setProgress(0);
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadFile({ projectId, kind, file, onProgress: setProgress });
      setDone(true);
      onUploaded?.();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon ?? iconFor[kind]} {label}
      </div>
      {!file ? (
        <label className="block cursor-pointer rounded-lg border border-dashed p-4 text-center text-xs text-[rgb(var(--muted-foreground))] transition-colors hover:border-[rgb(var(--primary))]/50">
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          Click to select a file
        </label>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <FileAudio className="h-3.5 w-3.5 flex-shrink-0 text-[rgb(var(--primary))]" />
              <span className="truncate">{file.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[rgb(var(--muted-foreground))]">{formatBytes(file.size)}</span>
              {!uploading && !done && (
                <button onClick={() => setFile(null)} className="text-[rgb(var(--muted-foreground))] hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {done && <Check className="h-4 w-4 text-[rgb(var(--success))]" />}
            </div>
          </div>
          {uploading && <ProgressBar value={progress} />}
          {!uploading && !done && (
            <Button size="sm" onClick={startUpload} className="mt-2 w-full">
              Upload
            </Button>
          )}
          {error && (
            <p className={cn("mt-2 text-xs text-[rgb(var(--danger))]")}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
