import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100
  showLabel?: boolean;
  className?: string;
  tone?: "primary" | "warning" | "danger" | "success";
}

const toneClass: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  primary: "bg-[rgb(var(--primary))]",
  success: "bg-[rgb(var(--success))]",
  warning: "bg-[rgb(var(--warning))]",
  danger: "bg-[rgb(var(--danger))]",
};

export function ProgressBar({ value, showLabel, className, tone = "primary" }: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--accent))]">
        <div
          className={cn("h-full transition-all duration-500", toneClass[tone])}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-[rgb(var(--muted-foreground))]">
          <span>{v.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
