"use client";

import React, { useEffect } from "react";
import { X, Copy, Check, FileCode, ArrowRight } from "lucide-react";

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  diffText: string;
}

export function DiffViewerModal({
  isOpen,
  onClose,
  title,
  subtitle,
  diffText,
}: DiffViewerModalProps) {
  const [copied, setCopied] = React.useState(false);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = diffText ? diffText.split("\n") : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copy Diff</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-2 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span className="text-muted-foreground">Additions (+)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              <span className="text-muted-foreground">Deletions (-)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
              <span className="text-muted-foreground">Unchanged Context</span>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            SHA-256 Delta Verification
          </span>
        </div>

        {/* Code Diff Body */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-zinc-950 text-zinc-100">
          {lines.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              No differences recorded for this snapshot.
            </div>
          ) : (
            <div className="space-y-0.5">
              {lines.map((line, idx) => {
                let lineClass = "text-zinc-300 hover:bg-zinc-900/60 px-2 py-0.5 rounded";
                if (line.startsWith("+")) {
                  lineClass = "bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500 px-2 py-0.5";
                } else if (line.startsWith("-")) {
                  lineClass = "bg-rose-950/60 text-rose-300 border-l-2 border-rose-500 px-2 py-0.5";
                } else if (line.startsWith("@")) {
                  lineClass = "text-indigo-400 bg-indigo-950/30 px-2 py-0.5 font-bold";
                }

                return (
                  <div key={idx} className={`flex items-start space-x-3 ${lineClass}`}>
                    <span className="w-8 shrink-0 select-none text-right text-zinc-600 font-mono">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-6 py-3 text-xs text-muted-foreground">
          <span>Captured via CompetePulse Diff Engine</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
