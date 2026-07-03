"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      side={
        <>
          <span className="chip chip-cyan">// new here?</span>
          <h1 className="display-lg mt-5">
            Bring a reference, <br />
            <span className="text-gradient">get a finished cut.</span>
          </h1>
          <p className="mt-4 text-fg-1">
            Two free credits on signup. No card, no commitment, no editing experience required.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-2">
            {[
              { k: "2", v: "free credits" },
              { k: "< 3 min", v: "to first edit" },
              { k: "GPU", v: "rendering" },
            ].map((s) => (
              <div key={s.v} className="glass rounded-xl p-3 text-center">
                <div className="font-display text-lg text-fg-0">{s.k}</div>
                <div className="text-[10px] uppercase tracking-wider text-fg-3">{s.v}</div>
              </div>
            ))}
          </div>
        </>
      }
    >
      <h2 className="font-display text-3xl font-semibold">Create account</h2>
      <p className="mt-2 text-sm text-fg-2">You start on the free plan with 2 credits.</p>

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
          <label className="label">Display name <span className="text-fg-3">(optional)</span></label>
          <input
            type="text"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="Alex Reyes"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="At least 8 characters"
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-fg-2">
        Already have an account?{" "}
        <Link href="/login" className="link text-fg-0">Sign in</Link>
      </p>
    </AuthShell>
  );
}
