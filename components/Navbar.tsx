import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radar,
  Plus,
  Sun,
  Moon,
  Database,
  Flame,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";

interface NavbarProps {
  onOpenAddModal: () => void;
  onRefreshAll: () => void;
  isRefreshing?: boolean;
}

export function Navbar({ onOpenAddModal, onRefreshAll, isRefreshing }: NavbarProps) {
  const [isDark, setIsDark] = useState(true);
  const pathname = usePathname();
  const [systemStatus, setSystemStatus] = useState<{
    supabase: boolean;
    firecrawl: boolean;
    openai: boolean;
    mode: string;
  }>({
    supabase: false,
    firecrawl: false,
    openai: false,
    mode: "interactive_demo",
  });

  useEffect(() => {
    // Check initial theme
    const isDarkTheme = document.documentElement.classList.contains("dark");
    setIsDark(isDarkTheme);

    // Fetch system integration status
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => console.warn("Failed to load status:", err));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const isAuditPage = pathname === "/audit";
  const isDashboard = pathname === "/";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
            <Radar className="h-5 w-5 animate-spin" style={{ animationDuration: "12s" }} />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-foreground">
                Compete<span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Pulse</span>
              </span>
              <span className="hidden rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-500 sm:inline-block">
                AI Intelligence
              </span>
            </div>
            <p className="hidden text-xs text-muted-foreground md:block">
              Continuous Competitor Delta Monitoring & Strategic Counter-Moves
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center space-x-1 md:flex">
          <Link
            href="/"
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              isDashboard
                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/audit"
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              isAuditPage
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>My Site Audit</span>
            {!isAuditPage && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-500/20">
                NEW
              </span>
            )}
          </Link>
        </nav>

        {/* Integration Status Badges */}
        <div className="hidden items-center space-x-2 lg:flex">
          <div
            title={systemStatus.supabase ? "Supabase PostgreSQL Connected" : "Local PostgreSQL In-Memory Fallback"}
            className="flex items-center space-x-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <Database className="h-3 w-3 text-emerald-500" />
            <span className="font-medium text-foreground">Supabase</span>
            <span className={`h-1.5 w-1.5 rounded-full ${systemStatus.supabase ? "bg-emerald-500" : "bg-amber-400"}`} />
          </div>

          <div
            title={systemStatus.firecrawl ? "Firecrawl API Active" : "Web Scraper Engine (Smart Fallback Active)"}
            className="flex items-center space-x-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <Flame className="h-3 w-3 text-amber-500" />
            <span className="font-medium text-foreground">Firecrawl</span>
            <span className={`h-1.5 w-1.5 rounded-full ${systemStatus.firecrawl ? "bg-emerald-500" : "bg-amber-400"}`} />
          </div>

          <div
            title={systemStatus.openai ? "OpenAI GPT-4o Connected" : "OpenAI GPT-4o (Smart Heuristic Fallback Active)"}
            className="flex items-center space-x-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span className="font-medium text-foreground">GPT-4o</span>
            <span className={`h-1.5 w-1.5 rounded-full ${systemStatus.openai ? "bg-emerald-500" : "bg-amber-400"}`} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Refresh All */}
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title="Refresh feed and data"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          {/* Dark / Light Mode Switcher */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          {/* Quick Add Competitor Button */}
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Competitor</span>
          </button>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="flex items-center space-x-1 border-t border-border px-4 py-2 md:hidden">
        <Link
          href="/"
          className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            isDashboard
              ? "bg-indigo-500/10 text-indigo-500"
              : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/audit"
          className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            isAuditPage
              ? "bg-amber-500/10 text-amber-500"
              : "text-muted-foreground"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>My Site Audit</span>
        </Link>
      </div>
    </header>
  );
}
