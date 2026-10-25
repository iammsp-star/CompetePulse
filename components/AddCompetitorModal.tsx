"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Sparkles, Globe, Building2, Tag } from "lucide-react";

interface AddCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCompetitorModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCompetitorModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("SaaS");
  const [targetType, setTargetType] = useState<"pricing" | "features" | "changelog" | "homepage" | "other">("pricing");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError("Please provide both Competitor Name and Target URL.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          category,
          target_type: targetType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add competitor");
      }

      setName("");
      setUrl("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (presetName: string, presetUrl: string, type: typeof targetType) => {
    setName(presetName);
    setUrl(presetUrl);
    setTargetType(type);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Track New Competitor
              </h3>
              <p className="text-xs text-muted-foreground">
                Enter target details for Firecrawl scraping & AI change tracking.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Fill Sample Suggestions */}
        <div className="mt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Fill Demo Suggestions:
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("Acme Cloud", "https://acmecloud.io/pricing", "pricing")}
              className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:border-indigo-500 hover:text-foreground transition-all"
            >
              Acme Pricing
            </button>
            <button
              type="button"
              onClick={() => applyPreset("Linear App", "https://linear.app/changelog", "changelog")}
              className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:border-indigo-500 hover:text-foreground transition-all"
            >
              Linear Changelog
            </button>
            <button
              type="button"
              onClick={() => applyPreset("Supabase", "https://supabase.com/pricing", "pricing")}
              className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:border-indigo-500 hover:text-foreground transition-all"
            >
              Supabase Pricing
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Competitor Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground">
              Competitor or Company Name
            </label>
            <div className="relative mt-1.5">
              <Building2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                placeholder="e.g. Acme Corp, Linear, Notion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Target URL */}
          <div>
            <label className="block text-xs font-semibold text-foreground">
              Target Page URL to Monitor
            </label>
            <div className="relative mt-1.5">
              <Globe className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                placeholder="https://competitor.com/pricing"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Target Type & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground">
                Page Type
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none transition-colors"
              >
                <option value="pricing">Pricing & Plans</option>
                <option value="features">Product Features</option>
                <option value="changelog">Changelog / Release</option>
                <option value="homepage">Homepage / Hero</option>
                <option value="other">Other / Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground">
                Industry Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none transition-colors"
              >
                <option value="SaaS">SaaS & Cloud</option>
                <option value="Developer Tools">Developer Tools</option>
                <option value="Analytics & AI">Analytics & AI</option>
                <option value="Sales & CRM">Sales & CRM</option>
                <option value="Fintech">Fintech</option>
                <option value="Security">Security & Infra</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-6 flex items-center justify-end space-x-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Adding Target...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Start Monitoring</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
