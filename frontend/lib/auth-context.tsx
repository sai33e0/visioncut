"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "./api";
import type { PublicUser } from "./types";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user on mount if a token exists
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
    if (!token) {
      setLoading(false);
      if (!PUBLIC_ROUTES.includes(pathname ?? "")) {
        router.replace("/login");
      }
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        if (PUBLIC_ROUTES.includes(pathname ?? "")) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        localStorage.removeItem("vc_token");
        if (!PUBLIC_ROUTES.includes(pathname ?? "")) {
          router.replace("/login");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      localStorage.setItem("vc_token", res.accessToken);
      setUser(res.user);
      router.replace("/dashboard");
    },
    [router]
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await api.register(email, password, displayName);
      localStorage.setItem("vc_token", res.accessToken);
      setUser(res.user);
      router.replace("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("vc_token");
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
