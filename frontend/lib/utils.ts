import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "done":
      return "text-[rgb(var(--success))] border-[rgb(var(--success))]";
    case "failed":
      return "text-[rgb(var(--danger))] border-[rgb(var(--danger))]";
    case "rendering":
    case "building":
    case "analyzing":
      return "text-[rgb(var(--warning))] border-[rgb(var(--warning))]";
    default:
      return "text-[rgb(var(--muted-foreground))] border-[rgb(var(--border))]";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "uploading":
      return "Uploading";
    case "analyzing":
      return "Analyzing";
    case "building":
      return "Building";
    case "rendering":
      return "Rendering";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}
