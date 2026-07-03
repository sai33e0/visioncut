"use client";

import { useCallback, useState } from "react";
import { Upload, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoDropzoneProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
}

export function VideoDropzone({
  onFileSelected,
  accept = "video/mp4,video/mov,video/webm",
  label = "Drop your video here",
  hint = "or click to browse — MP4, MOV, WebM up to 500 MB",
  className,
}: VideoDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
        dragOver
          ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/5"
          : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]/50 hover:bg-[rgb(var(--accent))]",
        className
      )}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
        }}
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--primary))]/15 text-[rgb(var(--primary))]">
        {dragOver ? <Film className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">{hint}</p>
      </div>
    </label>
  );
}
