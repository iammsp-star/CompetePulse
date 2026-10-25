"use client";

import React, { useState } from "react";
import {
  DollarSign,
  Rocket,
  Megaphone,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CheckCircle2,
  Code2,
} from "lucide-react";
import { Insight } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";

interface InsightCardProps {
  insight: Insight;
  onOpenDiffModal: (diff: string, title: string, subtitle?: string) => void;
}

export function InsightCard({ insight, onOpenDiffModal }: InsightCardProps) {
  const [showInlineDiff, setShowInlineDiff] = useState(false);

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case "pricing_change":
        return {
          label: "Pricing Change",
          icon: DollarSign,
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        };
      case "feature_launch":
        return {
          label: "Feature Launch",
          icon: Rocket,
          color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        };
      case "messaging_shift":
        return {
          label: "Messaging Shift",
          icon: Megaphone,
          color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        };
      default:
        return {
          label: "Competitive Update",
          icon: FileText,
          color: "text-slate-500 bg-slate-500/10 border-slate-500/20",
        };
    }
  };

  const getImpactBadge = (level: string) => {
    switch (level) {
      case "HIGH":
        return {
          label: "HIGH IMPACT",
          classes: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400 font-bold animate-pulse-slow",
        };
      case "MEDIUM":
        return {
          label: "MEDIUM IMPACT",
          classes: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400 font-semibold",
        };
      default:
        return {
          label: "LOW IMPACT",
          classes: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-400 font-medium",
        };
    }
  };

  const categoryMeta = getCategoryMeta(insight.category);
  const impactBadge = getImpactBadge(insight.impact_level);
  const CategoryIcon = categoryMeta.icon;

  const takeaways = Array.isArray(insight.key_takeaways)
    ? insight.key_takeaways
    : typeof insight.key_takeaways === "string"
    ? JSON.parse(insight.key_takeaways)
    : [];

  return (
    <div className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-indigo-500/30 hover:shadow-md">
      {/* Top Bar: Impact & Category Badges + Date */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
        <div className="flex items-center space-x-2">
          {/* Impact Badge */}
          <span
            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wider ${impactBadge.classes}`}
          >
            {impactBadge.label}
          </span>

          {/* Category Badge */}
          <span
            className={`inline-flex items-center space-x-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${categoryMeta.color}`}
          >
            <CategoryIcon className="h-3.5 w-3.5" />
            <span>{categoryMeta.label}</span>
          </span>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground font-mono">
          {formatRelativeTime(insight.created_at)}
        </span>
      </div>

      {/* Competitor & URL info */}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-foreground">
            {insight.competitor_name || "Competitor"}
          </h4>
          {insight.target_url && (
            <a
              href={insight.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-indigo-500 hover:text-indigo-400 hover:underline"
            >
              <span className="max-w-xs truncate sm:max-w-md">{insight.target_url}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4">
        <p className="text-sm leading-relaxed text-foreground/90 font-medium">
          {insight.summary}
        </p>
      </div>

      {/* Key Takeaways */}
      {takeaways.length > 0 && (
        <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-3.5 border border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Key Strategic Takeaways
          </span>
          <ul className="space-y-1.5 text-xs text-foreground/85">
            {takeaways.map((point: string, idx: number) => (
              <li key={idx} className="flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
                <span className="leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Counter-Action */}
      {insight.suggested_counter_action && (
        <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 dark:bg-indigo-950/20">
          <div className="flex items-center space-x-2 text-indigo-500">
            <Lightbulb className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Suggested Strategic Counter-Move
            </span>
          </div>
          <p className="mt-1 text-xs font-medium leading-relaxed text-foreground/90">
            {insight.suggested_counter_action}
          </p>
        </div>
      )}

      {/* Diff Toggle Bar */}
      {insight.diff_content && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
          <button
            onClick={() => setShowInlineDiff(!showInlineDiff)}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code2 className="h-3.5 w-3.5 text-indigo-500" />
            <span>{showInlineDiff ? "Hide Raw Text Diff" : "Toggle Raw Text Diff"}</span>
            {showInlineDiff ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={() =>
              onOpenDiffModal(
                insight.diff_content || "",
                `${insight.competitor_name || "Competitor"} - Delta Diff`,
                insight.target_url
              )
            }
            className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 hover:underline"
          >
            Open in Full Diff Viewer →
          </button>
        </div>
      )}

      {/* Inline Diff Preview */}
      {showInlineDiff && insight.diff_content && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
          <div className="max-h-56 overflow-y-auto space-y-1">
            {insight.diff_content.split("\n").map((line, i) => {
              let lineStyle = "text-zinc-400";
              if (line.startsWith("+")) lineStyle = "text-emerald-400 bg-emerald-950/50 px-1 rounded";
              if (line.startsWith("-")) lineStyle = "text-rose-400 bg-rose-950/50 px-1 rounded";
              return (
                <div key={i} className={`whitespace-pre-wrap ${lineStyle}`}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
