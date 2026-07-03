"use client";

import { useEffect, useRef } from "react";
import { useProjectProgress } from "@/lib/use-project-progress";
import { Terminal, Wifi, WifiOff } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function LiveEditingLog({ projectId }: { projectId: string }) {
  const { step, percent, logs, connected } = useProjectProgress(projectId);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b bg-[rgb(var(--accent))] px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Terminal className="h-3.5 w-3.5 text-[rgb(var(--primary))]" />
          Live editing log
        </div>
        <div className="flex items-center gap-1 text-xs text-[rgb(var(--muted-foreground))]">
          {connected ? <Wifi className="h-3 w-3 text-[rgb(var(--success))]" /> : <WifiOff className="h-3 w-3" />}
          {connected ? "connected" : "offline"}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[rgb(var(--muted-foreground))]">{step || "Idle"}</span>
          <span className="font-mono text-[rgb(var(--muted-foreground))]">{percent.toFixed(0)}%</span>
        </div>
        <ProgressBar value={Math.max(0, percent)} />
      </div>
      <div
        ref={logRef}
        className="h-56 overflow-y-auto border-t bg-[rgb(var(--background))] px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-[rgb(var(--muted-foreground))]">Waiting for events…</p>
        ) : (
          logs.map((l, i) => (
            <div
              key={i}
              className={
                l.level === "error"
                  ? "text-[rgb(var(--danger))]"
                  : l.level === "warn"
                  ? "text-[rgb(var(--warning))]"
                  : "text-[rgb(var(--muted-foreground))]"
              }
            >
              <span className="text-[rgb(var(--primary))]">[{new Date(l.timestamp).toLocaleTimeString()}]</span>{" "}
              {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
