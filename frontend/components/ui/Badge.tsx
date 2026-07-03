import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "primary";
  className?: string;
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))]",
  success: "border-[rgb(var(--success))]/40 text-[rgb(var(--success))]",
  warning: "border-[rgb(var(--warning))]/40 text-[rgb(var(--warning))]",
  danger: "border-[rgb(var(--danger))]/40 text-[rgb(var(--danger))]",
  primary: "border-[rgb(var(--primary))]/40 text-[rgb(var(--primary))]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return <span className={cn("badge", variants[variant], className)}>{children}</span>;
}
