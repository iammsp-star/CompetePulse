'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Search, AlertTriangle, CheckCircle, Loader2, ArrowLeft, Target, Lightbulb } from 'lucide-react';
import Link from 'next/link';

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

export default function AuditPage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userUrl, setUserUrl] = useState('');
  const [competitorsAnalyzed, setCompetitorsAnalyzed] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to perform audit');
      }

      setResult(data.data);
      setUserUrl(data.userUrl);
      setCompetitorsAnalyzed(data.competitorsAnalyzed);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Navbar
        onOpenAddModal={() => {}}
        onRefreshAll={() => {}}
        isRefreshing={false}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">My Site Weakness & Gap Analyzer</h1>
          <p className="mt-2 text-muted-foreground">
            Compare your website against tracked competitors to identify gaps and strengths
          </p>
        </div>

        {/* URL Input */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Enter Your Website URL
              </label>
              <div className="flex space-x-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
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
            </div>
          </form>
          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Analysis Results</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyzing {userUrl} against {competitorsAnalyzed} tracked competitor{competitorsAnalyzed !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Weaknesses / Gaps */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold">Weaknesses & Gaps</h3>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
                  {result.weaknesses.length}
                </span>
              </div>
              <div className="grid gap-4">
                {result.weaknesses.map((weakness, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-amber-500/20 bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                        <span className="text-lg">??</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="font-semibold text-foreground">{weakness.issue}</h4>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Benchmark</p>
                          <p className="text-sm text-foreground">{weakness.benchmark}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <Lightbulb className="h-3.5 w-3.5 text-emerald-500" />
                            <p className="text-xs font-medium text-emerald-500">How to Fix</p>
                          </div>
                          <p className="text-sm text-foreground">{weakness.howToFix}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <h3 className="text-lg font-semibold">Strengths</h3>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
                  {result.strengths.length}
                </span>
              </div>
              <div className="grid gap-4">
                {result.strengths.map((strength, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-emerald-500/20 bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
                        <span className="text-lg">?</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-2">{strength.advantage}</h4>
                        <p className="text-sm text-muted-foreground">{strength.details}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
