"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Globe, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { StyleCard } from "./StyleCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import type { Style } from "@/lib/types";
import { useRouter } from "next/navigation";

type Tab = "mine" | "public";

export function StyleBrowser() {
  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [applyTarget, setApplyTarget] = useState<Style | null>(null);
  const qc = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();

  const { data: mine } = useMyStyles();
  const { data: publicList } = usePublicStyles();

  const items = tab === "mine" ? mine ?? [] : publicList ?? [];
  const filtered = items.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const apply = useMutation({
    mutationFn: (projectId: string) => api.applyStyle(applyTarget!.id, projectId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["project", res.projectId] });
      qc.invalidateQueries({ queryKey: ["timeline", res.projectId] });
      setApplyTarget(null);
      router.push(`/project/${res.projectId}`);
    },
  });

  const deleteStyle = useMutation({
    mutationFn: (id: string) => api.deleteStyle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["styles", "mine"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border p-1">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
            <Lock className="h-3.5 w-3.5" /> Mine ({mine?.length ?? 0})
          </TabButton>
          <TabButton active={tab === "public"} onClick={() => setTab("public")}>
            <Globe className="h-3.5 w-3.5" /> Public ({publicList?.length ?? 0})
          </TabButton>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search styles…"
            className="input pl-7"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-sm text-[rgb(var(--muted-foreground))]">
          {tab === "mine"
            ? "You haven't saved any styles yet. Finish a project and click 'Save as Style'."
            : "No public styles to show."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="relative">
              <StyleCard
                style={s}
                onApply={user ? () => setApplyTarget(s) : undefined}
              />
              {tab === "mine" && (
                <button
                  onClick={() => {
                    if (confirm(`Delete style "${s.name}"?`)) deleteStyle.mutate(s.id);
                  }}
                  className="absolute right-3 top-3 text-xs text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--danger))]"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ApplyModal
        open={!!applyTarget}
        onClose={() => setApplyTarget(null)}
        onApply={async (projectId) => {
          apply.mutate(projectId);
        }}
        loading={apply.isPending}
        styleName={applyTarget?.name ?? ""}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-[rgb(var(--accent))] text-white"
          : "text-[rgb(var(--muted-foreground))] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

import { useQuery } from "@tanstack/react-query";
function useMyStyles() {
  return useQuery({ queryKey: ["styles", "mine"], queryFn: () => api.listStyles() });
}
function usePublicStyles() {
  return useQuery({
    queryKey: ["styles", "public"],
    queryFn: () => api.listPublicStyles(),
  });
}

function ApplyModal({
  open,
  onClose,
  onApply,
  loading,
  styleName,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (projectId: string) => void;
  loading: boolean;
  styleName: string;
}) {
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
  });
  const candidates = (projects ?? []).filter((p) => p.status !== "rendering" && p.status !== "analyzing");

  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title={`Apply "${styleName}"`}>
      {candidates.length === 0 ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          You need at least one project to apply a style to.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-[rgb(var(--muted-foreground))]">
            Pick a project. The blueprint template from this style will replace any existing blueprint.
          </p>
          <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selected === p.id
                      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10"
                      : "border-[rgb(var(--border))] hover:bg-[rgb(var(--accent))]"
                  )}
                >
                  {p.name}
                  <span className="ml-2 text-xs text-[rgb(var(--muted-foreground))]">
                    {p.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => selected && onApply(selected)}
              disabled={!selected}
              loading={loading}
            >
              Apply
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
