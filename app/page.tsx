"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { KpiSummary } from "@/components/KpiSummary";
import { CompetitorCard } from "@/components/CompetitorCard";
import { InsightCard } from "@/components/InsightCard";
import { AddCompetitorModal } from "@/components/AddCompetitorModal";
import { DiffViewerModal } from "@/components/DiffViewerModal";
import { Competitor, Insight } from "@/lib/supabase";
import {
  Activity,
  Layers,
  Sparkles,
  Filter,
  Search,
  Plus,
  RefreshCw,
  Zap,
  ShieldAlert,
} from "lucide-react";

export default function DashboardPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [diffModal, setDiffModal] = useState<{
    isOpen: boolean;
    diff: string;
    title: string;
    subtitle?: string;
  }>({
    isOpen: false,
    diff: "",
    title: "",
    subtitle: "",
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [impactFilter, setImpactFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"insights" | "monitors">("insights");

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [compRes, insRes] = await Promise.all([
        fetch("/api/competitors"),
        fetch("/api/insights"),
      ]);

      const compData = await compRes.json();
      const insData = await insRes.json();

      if (compData.success) {
        setCompetitors(compData.data || []);
      }
      if (insData.success) {
        setInsights(insData.data || []);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived KPI metrics
  const totalCompetitors = competitors.length;
  const totalPagesScraped = competitors.reduce(
    (acc, curr) => acc + (curr.targets?.length || 0),
    0
  );
  const highImpactCount = insights.filter((i) => i.impact_level === "HIGH").length;
  const totalInsights = insights.length;

  // Filtered insights
  const filteredInsights = insights.filter((insight) => {
    const matchesSearch =
      (insight.competitor_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      insight.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (insight.suggested_counter_action || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesImpact = impactFilter === "ALL" || insight.impact_level === impactFilter;
    const matchesCategory = categoryFilter === "ALL" || insight.category === categoryFilter;

    return matchesSearch && matchesImpact && matchesCategory;
  });

  // Filtered competitors
  const filteredCompetitors = competitors.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.domain || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      {/* Top Navigation */}
      <Navbar
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onRefreshAll={fetchData}
        isRefreshing={isRefreshing}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Hero Banner / Header Greeting */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Competitive Intelligence Radar
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Delta Engine
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Autonomous Firecrawl scraping, SHA-256 content verification, and OpenAI GPT-4o strategic evaluations.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Track New Competitor</span>
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <KpiSummary
          totalCompetitors={totalCompetitors}
          totalPagesScraped={totalPagesScraped}
          highImpactCount={highImpactCount}
          totalInsights={totalInsights}
        />

        {/* Navigation Tabs & Search/Filters */}
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex items-center space-x-1 rounded-xl bg-muted/60 p-1 border border-border">
            <button
              onClick={() => setActiveTab("insights")}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "insights"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span>AI Strategic Feed</span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.2 text-[10px] text-indigo-500 font-bold">
                {insights.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("monitors")}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "monitors"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span>Monitored Competitors</span>
              <span className="rounded-full bg-muted px-2 py-0.2 text-[10px] text-muted-foreground font-bold">
                {competitors.length}
              </span>
            </button>
          </div>

          {/* Search Bar & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search competitors or terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-xl border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none transition-colors w-48 sm:w-60"
              />
            </div>

            {/* Impact Filter */}
            {activeTab === "insights" && (
              <>
                <select
                  value={impactFilter}
                  onChange={(e) => setImpactFilter(e.target.value)}
                  className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Impacts</option>
                  <option value="HIGH">High Impact Only</option>
                  <option value="MEDIUM">Medium Impact</option>
                  <option value="LOW">Low Impact</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Categories</option>
                  <option value="pricing_change">Pricing Changes</option>
                  <option value="feature_launch">Feature Launches</option>
                  <option value="messaging_shift">Messaging Shifts</option>
                  <option value="other">Other Updates</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Synchronizing competitor telemetry...</p>
          </div>
        ) : activeTab === "insights" ? (
          /* INSIGHTS FEED TAB */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Strategic Delta Feed
                </h3>
                <p className="text-xs text-muted-foreground">
                  AI-extracted insights categorized by impact with tactical counter-maneuvers.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Showing {filteredInsights.length} of {insights.length} insights
              </span>
            </div>

            {filteredInsights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <h4 className="mt-3 text-sm font-semibold text-foreground">
                  No insights match your filter
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your search criteria, or trigger a manual scan on a competitor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {filteredInsights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onOpenDiffModal={(diff, title, subtitle) =>
                      setDiffModal({ isOpen: true, diff, title, subtitle })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* COMPETITORS & TARGETS TAB */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Monitored Competitor Targets
                </h3>
                <p className="text-xs text-muted-foreground">
                  Trigger on-demand Firecrawl scrapes and SHA-256 delta checks per target.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Another Target</span>
              </button>
            </div>

            {filteredCompetitors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <h4 className="mt-3 text-sm font-semibold text-foreground">
                  No competitors tracked yet
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first competitor URL to begin automated delta monitoring.
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-4 inline-flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Competitor</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredCompetitors.map((comp) => (
                  <CompetitorCard
                    key={comp.id}
                    competitor={comp}
                    onAnalysisComplete={fetchData}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Competitor Modal */}
      <AddCompetitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* Diff Viewer Modal */}
      <DiffViewerModal
        isOpen={diffModal.isOpen}
        onClose={() => setDiffModal((prev) => ({ ...prev, isOpen: false }))}
        title={diffModal.title}
        subtitle={diffModal.subtitle}
        diffText={diffModal.diff}
      />
    </div>
  );
}
