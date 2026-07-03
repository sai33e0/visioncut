"use client";

import { useAuth } from "@/lib/auth-context";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-fg-2">
          <span className="pulse-dot" /> Loading…
        </div>
      </div>
    );
  }
  if (!user) return null;
  return (
    <div className="min-h-screen pb-16">
      <TopBar />
      <main className="container-page pt-8">{children}</main>
    </div>
  );
}
