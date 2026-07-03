"use client";

import { AppShell } from "@/components/layout/AppShell";
import { StyleBrowser } from "@/components/styles/StyleBrowser";

export default function StylesPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Style library</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
          Browse styles you've saved or community styles. Apply a style to a new
          project — no reference video required.
        </p>
      </div>
      <StyleBrowser />
    </AppShell>
  );
}
