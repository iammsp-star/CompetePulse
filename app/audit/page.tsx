'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Target,
  Lightbulb,
  ShieldAlert,
  Zap,
  TrendingUp,
  ArrowRight,
  Globe,
  BarChart3,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface Weakness {
  issue: string;
  benchmark: string;
  howToFix: string;
}

interface Strength {
  advantage: string;
  details: string;
}

interface AuditResult {
  weaknesses: Weakness[];
  strengths: Strength[];
}

const EXAMPLE_URLS = [
  'https://stripe.com',
  'https://notion.so',
  'https://linear.app',
  'https://vercel.com',
];

export default function AuditPage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userUrl, setUserUrl] = useState('');
  const [competitorsAnalyzed, setCompetitorsAnalyzed] = useState(0);
  const [mode, setMode] = useState<string>('');
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a URL to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    // Simulate progress steps
    const steps = [15, 35, 55, 75, 90];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < steps.length) {
        setProgress(steps[stepIndex]);
        stepIndex++;
      }
    }, 1200);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to perform audit');
      }

      setProgress(100);
      setResult(data.data);
      setUserUrl(data.userUrl);
      setCompetitorsAnalyzed(data.competitorsAnalyzed);
      setMode(data.mode || 'ai');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setProgress(0);
    }
  };

  const gapScore = result
    ? Math.max(
        0,
        100 - result.weaknesses.length * 14 + result.strengths.length * 8
      )
    : null;

  const scoreColor =
    gapScore === null
      ? ''
      : gapScore >= 70
      ? 'text-emerald-500'
      : gapScore >= 45
      ? 'text-amber-500'
      : 'text-red-500';

  const scoreBg =
    gapScore === null
      ? ''
      : gapScore >= 70
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : gapScore >= 45
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-red-500/10 border-red-500/20';

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Navbar
        onOpenAddModal={() => {}}
        onRefreshAll={() => {}}
        isRefreshing={false}
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-500 mb-4">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>AI-Powered Competitive Gap Analysis</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            My Site{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Weakness &amp; Gap
            </span>{' '}
            Analyzer
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl mx-auto">
            Paste your website URL and our AI will scrape it, compare against all tracked competitors,
            and deliver a structured breakdown of your gaps and competitive advantages.
          </p>
        </div>

        {/* URL Input Card */}
        <div className="relative rounded-2xl border border-border bg-card shadow-xl shadow-black/5 overflow-hidden mb-8">
          {/* Gradient accent top bar */}
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-semibold text-foreground mb-1">
                Your Website URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="audit-url-input"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-60"
                  />
                </div>
                <button
                  id="run-audit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 transition-all active:scale-[0.98] whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4" />
                      <span>Run Gap Analysis</span>
                    </>
                  )}
                </button>
              </div>

              {/* Example URLs */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Try:</span>
                {EXAMPLE_URLS.map((exUrl) => (
                  <button
                    key={exUrl}
                    type="button"
                    onClick={() => setUrl(exUrl)}
                    disabled={isLoading}
                    className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
                  >
                    {exUrl.replace('https://', '')}
                  </button>
                ))}
              </div>
            </form>

            {/* Progress bar */}
            {isLoading && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span>
                      {progress < 20
                        ? 'Scraping your website with Firecrawl...'
                        : progress < 50
                        ? 'Fetching competitor snapshots from Supabase...'
                        : progress < 80
                        ? 'Running GPT-4o competitive gap analysis...'
                        : 'Structuring results...'}
                    </span>
                  </span>
                  <span className="font-semibold text-amber-500">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start space-x-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Summary Row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Score */}
              <div className={`col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-2xl border p-5 ${scoreBg}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Gap Score</p>
                <p className={`text-4xl font-black tabular-nums ${scoreColor}`}>{gapScore}</p>
                <p className="text-xs text-muted-foreground mt-1">out of 100</p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <AlertTriangle className="h-5 w-5 text-amber-500 mb-1" />
                <p className="text-3xl font-black text-amber-500 tabular-nums">{result.weaknesses.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Gaps Found</p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <CheckCircle className="h-5 w-5 text-emerald-500 mb-1" />
                <p className="text-3xl font-black text-emerald-500 tabular-nums">{result.strengths.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Strengths</p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                <BarChart3 className="h-5 w-5 text-indigo-500 mb-1" />
                <p className="text-3xl font-black text-indigo-500 tabular-nums">{competitorsAnalyzed}</p>
                <p className="text-xs text-muted-foreground mt-1">Competitors</p>
              </div>
            </div>

            {/* Context bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Analyzed:</span>
                <a
                  href={userUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground hover:text-amber-500 transition-colors truncate max-w-xs"
                >
                  {userUrl}
                </a>
              </div>
              <div className="flex items-center space-x-2">
                {mode === 'heuristic_fallback' && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                    Heuristic Mode (no OpenAI key)
                  </span>
                )}
                <button
                  onClick={() => {
                    setResult(null);
                    setUrl('');
                    setUserUrl('');
                    setMode('');
                  }}
                  className="inline-flex items-center space-x-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>New Analysis</span>
                </button>
              </div>
            </div>

            {/* Weaknesses / Gaps Section */}
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">⚠️ Gaps &amp; Weaknesses</h2>
                  <p className="text-xs text-muted-foreground">Areas where competitors have a clear advantage over your site</p>
                </div>
                <span className="ml-auto rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-500">
                  {result.weaknesses.length} found
                </span>
              </div>

              <div className="grid gap-4">
                {result.weaknesses.map((weakness, idx) => (
                  <div
                    key={idx}
                    id={`weakness-${idx}`}
                    className="group rounded-2xl border border-amber-500/15 bg-card shadow-sm hover:border-amber-500/35 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-5">
                      <div className="flex items-start space-x-4">
                        {/* Index */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-black text-amber-500">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Issue title */}
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-foreground text-sm leading-snug">
                              ⚠️ {weakness.issue}
                            </h3>
                            <span className="shrink-0 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                              Gap
                            </span>
                          </div>

                          {/* Benchmark */}
                          <div className="rounded-xl bg-muted/50 border border-border/50 p-3.5">
                            <div className="flex items-center space-x-1.5 mb-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Competitor Benchmark</p>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{weakness.benchmark}</p>
                          </div>

                          {/* How to fix */}
                          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5">
                            <div className="flex items-center space-x-1.5 mb-1.5">
                              <Lightbulb className="h-3.5 w-3.5 text-emerald-500" />
                              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">How to Fix</p>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">{weakness.howToFix}</p>
                            <div className="mt-2.5 flex items-center space-x-1 text-xs font-semibold text-emerald-500">
                              <span>Take action</span>
                              <ArrowRight className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths Section */}
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">✅ Competitive Strengths</h2>
                  <p className="text-xs text-muted-foreground">Areas where your site has a clear advantage over competitors</p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-500">
                  {result.strengths.length} found
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {result.strengths.map((strength, idx) => (
                  <div
                    key={idx}
                    id={`strength-${idx}`}
                    className="group rounded-2xl border border-emerald-500/15 bg-card p-5 shadow-sm hover:border-emerald-500/35 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-lg">✅</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-foreground text-sm leading-snug">{strength.advantage}</h3>
                          <span className="shrink-0 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                            Strength
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{strength.details}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Footer */}
            <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 p-6 text-center">
              <Zap className="mx-auto h-8 w-8 text-indigo-500 mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-1">Want real-time competitor monitoring?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your competitors to CompetePulse and get automated alerts whenever their pricing, features, or messaging changes.
              </p>
              <a
                href="/"
                className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/25"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* Empty state (before analysis) */}
        {!result && !isLoading && !error && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: <Globe className="h-6 w-6 text-amber-500" />,
                title: 'Step 1: Scrape Your Site',
                desc: 'We use Firecrawl to extract the full content of your website — headings, copy, pricing, and more.',
                bg: 'bg-amber-500/5 border-amber-500/15',
              },
              {
                icon: <BarChart3 className="h-6 w-6 text-indigo-500" />,
                title: 'Step 2: Benchmark Competitors',
                desc: 'Your site content is compared against all tracked competitors and their stored snapshots in Supabase.',
                bg: 'bg-indigo-500/5 border-indigo-500/15',
              },
              {
                icon: <Sparkles className="h-6 w-6 text-violet-500" />,
                title: 'Step 3: GPT-4o Analysis',
                desc: 'OpenAI GPT-4o synthesizes the data and returns structured gaps, benchmarks, and fix recommendations.',
                bg: 'bg-violet-500/5 border-violet-500/15',
              },
            ].map((step, i) => (
              <div key={i} className={`rounded-2xl border p-5 ${step.bg}`}>
                <div className="mb-3">{step.icon}</div>
                <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
