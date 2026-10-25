"use client";

import React from "react";
import { Building2, Globe2, AlertTriangle, ShieldCheck } from "lucide-react";

interface KpiSummaryProps {
  totalCompetitors: number;
  totalPagesScraped: number;
  highImpactCount: number;
  totalInsights: number;
}

export function KpiSummary({
  totalCompetitors,
  totalPagesScraped,
  highImpactCount,
  totalInsights,
}: KpiSummaryProps) {
  const kpis = [
    {
      title: "Monitored Competitors",
      value: totalCompetitors,
      subtitle: "Active competitor domains",
      icon: Building2,
      iconColor: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
    },
    {
      title: "Pages Scraped & Monitored",
      value: totalPagesScraped,
      subtitle: "Firecrawl markdown snapshots",
      icon: Globe2,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      title: "High Impact Delta Alerts",
      value: highImpactCount,
      subtitle: "Requires immediate counter-action",
      icon: AlertTriangle,
      iconColor: "text-rose-500",
      bgColor: "bg-rose-500/10",
      borderColor: "border-rose-500/20",
      badge: highImpactCount > 0 ? "Attention Required" : "All Clear",
      badgeColor: highImpactCount > 0 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400",
    },
    {
      title: "AI Insights Generated",
      value: totalInsights,
      subtitle: "GPT-4o strategic evaluations",
      icon: ShieldCheck,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, idx) => {
        const IconComponent = kpi.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl border ${kpi.borderColor} bg-card p-5 shadow-sm transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.title}
              </span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.bgColor}`}>
                <IconComponent className={`h-4.5 w-4.5 ${kpi.iconColor}`} />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {kpi.value}
              </div>
              {kpi.badge && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${kpi.badgeColor}`}>
                  {kpi.badge}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {kpi.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
