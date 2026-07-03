"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, BarChart3, LogOut, Coins, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/styles", label: "Styles", icon: Library },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

export function TopBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30">
      <div className="container-page">
        <div className="glass-strong mt-3 flex h-14 items-center justify-between rounded-2xl px-3">
          <div className="flex items-center gap-6 pl-2">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Logo size={26} />
              <span className="font-display text-sm font-semibold">VisionCut</span>
            </Link>
            <nav className="flex items-center gap-1">
              {links.map((l) => {
                const Icon = l.icon;
                const active =
                  pathname === l.href ||
                  (l.href !== "/dashboard" && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all",
                      active
                        ? "bg-white/10 text-white"
                        : "text-fg-1 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 pr-1">
            {user && (
              <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs md:inline-flex">
                <Coins className="h-3.5 w-3.5 text-amber" />
                <span className="font-mono">{user.credits}</span>
                <span className="ml-1 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-2">
                  {user.plan}
                </span>
              </div>
            )}
            <Link href="/project/new" className="btn-primary hidden md:inline-flex py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> New
            </Link>
            <button onClick={logout} className="btn-icon" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
