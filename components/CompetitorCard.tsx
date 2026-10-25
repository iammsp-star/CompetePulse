"use client";

import React, { useState } from "react";
import {
  Globe,
  ExternalLink,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Check,
  Tag,
} from "lucide-react";
import { Competitor, MonitoredTarget } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";

interface CompetitorCardProps {
  competitor: Competitor;
  onAnalysisComplete: () => void;
}

export function CompetitorCard({
  competitor,
  onAnalysisComplete,
}: CompetitorCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "unchanged" | "error";
  } | null>(null);

  const primaryTarget: MonitoredTarget | undefined = competitor.targets?.[0];

  const handleRunAnalysis = async () => {
    if (!primaryTarget) return;

    setIsRunning(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: primaryTarget.id,
          competitorId: competitor.id,
          url: primaryTarget.url,
          competitorName: competitor.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to complete analysis");
      }

      if (data.hasChanged) {
        setStatusMessage({
          text: "Change detected! Strategic insight generated.",
          type: "success",
        });
        onAnalysisComplete();
      } else {
        setStatusMessage({
          text: "SHA-256 matched: Content unchanged. Skipped AI call.",
          type: "unchanged",
        });
      }
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setStatusMessage({
        text: err.message || "Analysis encountered an error.",
        type: "error",
      });
    } finally {
      setIsRunning(false);
      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "changed":
        return {
          label: "Delta Detected",
          color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        };
      case "active":
        return {
          label: "Active & Synced",
          color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        };
      case "error":
        return {
          label: "Check Failed",
          color: "bg-red-500/10 text-red-500 border-red-500/20",
        };
      default:
        return {
          label: "Pending Verification",
          color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        };
    }
  };

  const statusBadge = getStatusBadge(primaryTarget?.last_status);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-indigo-500/30 hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground font-bold uppercase tracking-wider border border-border">
              {competitor.name.slice(0, 2)}
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground line-clamp-1">
                {competitor.name}
              </h4>
              <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                <span>{competitor.domain || "domain.com"}</span>
              </div>
            </div>
          </div>

          <span
            className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${statusBadge.color}`}
          >
            {statusBadge.label}
          </span>
        </div>

        {/* Monitored URL */}
        {primaryTarget && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Monitored URL ({primaryTarget.target_type})
              </span>
              <a
                href={primaryTarget.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:text-indigo-400 flex items-center space-x-0.5"
              >
                <span>Visit</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="mt-1 text-xs font-mono text-foreground truncate">
              {primaryTarget.url}
            </p>
          </div>
        )}

        {/* Category & Timing */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center space-x-1">
            <Tag className="h-3 w-3" />
            <span>{competitor.category || "SaaS"}</span>
          </span>
          <span className="inline-flex items-center space-x-1 font-mono">
            <Clock className="h-3 w-3" />
            <span>Last Scanned: {formatRelativeTime(primaryTarget?.last_scraped_at)}</span>
          </span>
        </div>
      </div>

      {/* Action / Trigger Button */}
      <div className="mt-5 border-t border-border pt-4">
        {statusMessage && (
          <div
            className={`mb-3 flex items-center space-x-1.5 rounded-lg p-2 text-xs font-medium animate-fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : statusMessage.type === "unchanged"
                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
            }`}
          >
            {statusMessage.type === "success" ? (
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
            ) : statusMessage.type === "unchanged" ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{statusMessage.text}</span>
          </div>
        )}

        <button
          onClick={handleRunAnalysis}
          disabled={isRunning || !primaryTarget}
          className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition-all disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent" />
              <span>Scraping & Computing Delta...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
