"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { API_URL } from "./api";
import type { LogEvent, ProgressEvent } from "./types";

export interface ProjectProgressState {
  step: string;
  percent: number;
  detail?: string;
  logs: LogEvent[];
  connected: boolean;
}

/**
 * Subscribe to /api/analysis progress + log events for a single project.
 * Joins a socket.io room by projectId; cleans up on unmount.
 */
export function useProjectProgress(projectId: string | null | undefined): ProjectProgressState {
  const [state, setState] = useState<ProjectProgressState>({
    step: "",
    percent: 0,
    logs: [],
    connected: false,
  });
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", projectId);
      setState((s) => ({ ...s, connected: true }));
    });
    socket.on("disconnect", () => {
      setState((s) => ({ ...s, connected: false }));
    });
    socket.on("progress", (payload: ProgressEvent) => {
      setState((s) => ({
        ...s,
        step: payload.step,
        percent: payload.percent < 0 ? s.percent : Math.max(s.percent, payload.percent),
        detail: payload.detail,
      }));
    });
    socket.on("log", (payload: LogEvent) => {
      setState((s) => ({ ...s, logs: [...s.logs, payload].slice(-200) }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  return state;
}
