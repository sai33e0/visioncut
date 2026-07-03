"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Upload, Sparkles, ArrowRight, ArrowLeft, Check, Music, Mic, Volume2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { VideoDropzone } from "@/components/upload/VideoDropzone";
import { AssetUploader } from "@/components/upload/AssetUploader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { easeOut } from "@/lib/motion";

type Step = "info" | "reference" | "clips" | "extras";

const STEPS: { key: Step; label: string; hint: string }[] = [
  { key: "info", label: "Info", hint: "Give your project a name." },
  { key: "reference", label: "Reference", hint: "Upload the video whose style you want." },
  { key: "clips", label: "Clips", hint: "Drop your raw footage." },
  { key: "extras", label: "Extras", hint: "Optional: music, voiceover, SFX." },
];

export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("info");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createProject({ name, description: description || undefined }),
    onSuccess: (project) => {
      setProjectId(project.id);
      setStep("reference");
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? "Could not create project"),
  });

  const startAnalysis = useMutation({
    mutationFn: () => api.startAnalysis(projectId!),
    onSuccess: () => router.push(`/project/${projectId}`),
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? "Could not start analysis"),
  });

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-2">
          <span className="label">// new project · step {stepIdx + 1} of {STEPS.length}</span>
          <h1 className="display-md mt-2">{STEPS[stepIdx].hint}</h1>
        </div>

        {/* Step progress */}
        <div className="mb-10 mt-8">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-white/5" />
            <motion.div
              className="absolute left-0 top-1/2 -z-10 h-px"
              style={{
                background: "linear-gradient(90deg, rgb(var(--violet)), rgb(var(--cyan)), rgb(var(--magenta)))",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(stepIdx / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.6, ease: easeOut }}
            />
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s.key} className="flex flex-col items-center gap-2">
                  <motion.div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                      done
                        ? "border-cyan bg-cyan/20 text-cyan"
                        : active
                        ? "border-violet bg-violet/20 text-violet-2"
                        : "border-white/10 bg-bg-1 text-fg-3"
                    }`}
                    animate={active ? { scale: [1, 1.06, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-mono">{i + 1}</span>}
                  </motion.div>
                  <span className={`text-[10px] uppercase tracking-wider ${active ? "text-fg-0" : "text-fg-3"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 chip chip-danger w-full justify-start text-xs">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="glass-card p-8"
            >
              <div className="space-y-5">
                <div>
                  <label className="label">Project name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Summer Reel 2025"
                    minLength={3}
                    maxLength={100}
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Description <span className="text-fg-3">(optional)</span></label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="input"
                    placeholder="What is this video for?"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-xs text-fg-3">
                    {user?.credits} credit{user?.credits === 1 ? "" : "s"} remaining
                  </span>
                  <button
                    onClick={() => create.mutate()}
                    disabled={create.isPending || name.length < 3}
                    className="btn-primary"
                  >
                    {create.isPending ? "Creating…" : "Continue"} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "reference" && projectId && (
            <motion.div
              key="reference"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="glass-card p-8"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet/20 text-violet-2">
                  <Film className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold">Reference video</h2>
                  <p className="text-xs text-fg-2">
                    The system will analyze pace, transitions, and audio to build a blueprint.
                  </p>
                </div>
              </div>
              <ReferenceUploader projectId={projectId} onUploaded={() => setStep("clips")} />
            </motion.div>
          )}

          {step === "clips" && projectId && (
            <motion.div
              key="clips"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="glass-card p-8"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/20 text-cyan">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold">Your clips</h2>
                  <p className="text-xs text-fg-2">
                    5–10 varied clips is a good starting point. Drop one at a time or many.
                  </p>
                </div>
              </div>
              <ClipUploader projectId={projectId} onUploaded={() => setStep("extras")} />
            </motion.div>
          )}

          {step === "extras" && projectId && (
            <motion.div
              key="extras"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="glass-card p-8"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-magenta/20 text-magenta">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold">Optional assets</h2>
                  <p className="text-xs text-fg-2">
                    Upload music, voiceover, or SFX if the blueprint calls for them.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <AssetUploader projectId={projectId} kind="music" label="Music track" icon={<Music className="h-4 w-4" />} />
                <AssetUploader projectId={projectId} kind="voiceover" label="Voiceover" icon={<Mic className="h-4 w-4" />} />
                <AssetUploader projectId={projectId} kind="sfx" label="Sound effects" icon={<Volume2 className="h-4 w-4" />} />
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button onClick={() => setStep("clips")} className="btn-ghost">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => startAnalysis.mutate()}
                  disabled={startAnalysis.isPending}
                  className="btn-primary px-6 py-3 text-base"
                >
                  {startAnalysis.isPending ? "Starting…" : "Start analysis"}
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

function ReferenceUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadFile({ projectId, kind: "reference", file, onProgress: setPct });
      onUploaded();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!file ? (
        <VideoDropzone
          onFileSelected={setFile}
          label="Drop the reference video"
          hint="MP4 / MOV / WebM · up to 500 MB"
        />
      ) : (
        <div className="space-y-3">
          <div className="glass flex items-center justify-between p-4 text-sm">
            <div className="flex items-center gap-3 truncate">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet/20 text-violet-2">
                <Film className="h-4 w-4" />
              </div>
              <span className="truncate font-mono text-xs">{file.name}</span>
            </div>
            {!busy && pct < 100 && (
              <button onClick={() => setFile(null)} className="text-xs link">
                Replace
              </button>
            )}
          </div>
          {busy && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full"
                style={{ background: "linear-gradient(90deg, rgb(var(--violet)), rgb(var(--cyan)))" }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
              />
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          {!busy && pct < 100 && (
            <button onClick={upload} className="btn-primary w-full justify-center py-3">
              Upload reference
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ClipUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  };

  const uploadAll = async () => {
    setBusy(true);
    let n = 0;
    for (const f of files) {
      try {
        await api.uploadFile({ projectId, kind: "clip", file: f });
        n++;
        setDone(n);
      } catch {
        /* continue */
      }
    }
    setBusy(false);
    onUploaded();
  };

  return (
    <div>
      <VideoDropzone
        onFileSelected={(f) => setFiles((p) => [...p, f])}
        label="Drop clips here, one at a time"
        hint="Or click to browse — add multiple clips"
        accept="video/mp4,video/mov,video/webm,video/quicktime"
      />
      {files.length > 0 && (
        <div className="mt-5 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="glass flex items-center justify-between p-3 text-sm">
              <span className="truncate font-mono text-xs">{f.name}</span>
              <span className="text-xs">
                {i < done ? (
                  <span className="chip chip-success">uploaded</span>
                ) : i === done && busy ? (
                  <span className="chip chip-cyan">uploading…</span>
                ) : (
                  <span className="text-fg-3">queued</span>
                )}
              </span>
            </div>
          ))}
          <button onClick={uploadAll} disabled={busy} className="btn-primary w-full justify-center py-3">
            {busy ? "Uploading…" : `Upload ${files.length} clip${files.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
