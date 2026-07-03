"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      side={
        <>
          <span className="chip chip-violet">// welcome back</span>
          <h1 className="display-lg mt-5">
            Your next edit is <span className="text-gradient">one click away.</span>
          </h1>
          <p className="mt-4 text-fg-1">
            Pick up where you left off — your styles, projects, and feedback are all here.
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs font-mono text-fg-2">
            <Sparkles className="h-3.5 w-3.5 text-cyan" />
            <span>demo@visioncut.ai / demo1234</span>
          </div>
        </>
      }
    >
      <h2 className="font-display text-3xl font-semibold">Sign in</h2>
      <p className="mt-2 text-sm text-fg-2">Use the email you signed up with.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@studio.com"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="chip chip-danger w-full justify-start text-xs">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-3.5"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-fg-2">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="link text-fg-0">Create one</Link>
      </p>
    </AuthShell>
  );
}
