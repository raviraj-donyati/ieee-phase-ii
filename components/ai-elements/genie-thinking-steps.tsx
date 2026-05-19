"use client";

import { memo } from "react";
import {
  Database, HelpCircle, Lightbulb, ListChecks,
  BookOpen, CheckCircle2, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenieThought } from "@/types";

const THOUGHT_ICON: Record<string, React.ElementType> = {
  THOUGHT_TYPE_DATA_SOURCING:  Database,
  THOUGHT_TYPE_DESCRIPTION:    HelpCircle,
  THOUGHT_TYPE_DEFINITION:     BookOpen,
  THOUGHT_TYPE_INTERPRETATION: Lightbulb,
  THOUGHT_TYPE_STEPS:          ListChecks,
};

// Canonical display order
const THOUGHT_ORDER = [
  "THOUGHT_TYPE_DATA_SOURCING",
  "THOUGHT_TYPE_DESCRIPTION",
  "THOUGHT_TYPE_DEFINITION",
  "THOUGHT_TYPE_INTERPRETATION",
  "THOUGHT_TYPE_STEPS",
];

interface GenieThinkingStepsProps {
  thoughts: GenieThought[];
  isStreaming: boolean;
}

export const GenieThinkingSteps = memo(({ thoughts, isStreaming }: GenieThinkingStepsProps) => {
  if (thoughts.length === 0) {
    // Still waiting for first thought — show a single pulsing row
    if (!isStreaming) return null;
    return (
      <div className="flex items-center gap-2.5 py-1 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 animate-pulse text-primary/60" />
        <span className="animate-pulse">Analyzing your question…</span>
      </div>
    );
  }

  // Sort by canonical order, unknown types go last
  const sorted = [...thoughts].sort(
    (a, b) =>
      (THOUGHT_ORDER.indexOf(a.thoughtType) === -1 ? 99 : THOUGHT_ORDER.indexOf(a.thoughtType)) -
      (THOUGHT_ORDER.indexOf(b.thoughtType) === -1 ? 99 : THOUGHT_ORDER.indexOf(b.thoughtType))
  );

  return (
    <div className="flex flex-col py-1">
      {sorted.map((thought, idx) => {
        const isLast = idx === sorted.length - 1;
        const isActive = isLast && isStreaming;
        const Icon = THOUGHT_ICON[thought.thoughtType] ?? Sparkles;

        return (
          <div key={thought.thoughtType} className="flex gap-3 animate-in fade-in duration-400" style={{ animationFillMode: "both" }}>
            {/* Spine */}
            <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
              <div
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border shrink-0 transition-all duration-300",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}
              >
                {isActive
                  ? <Loader2 className="size-2.5 animate-spin" />
                  : <CheckCircle2 className="size-2.5" />
                }
              </div>
              {!isLast && (
                <div className={cn(
                  "w-px flex-1 my-1 transition-colors duration-500",
                  isActive ? "bg-border" : "bg-emerald-500/25"
                )} />
              )}
            </div>

            {/* Content */}
            <div className={cn("min-w-0 pb-3", isLast && "pb-1")}>
              {/* Label row */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className={cn(
                  "size-3 shrink-0",
                  isActive ? "text-primary/70" : "text-muted-foreground/60"
                )} />
                <span className={cn(
                  "text-[11px] font-semibold uppercase tracking-wide leading-5",
                  isActive ? "text-primary/80" : "text-foreground/70"
                )}>
                  {thought.label}
                </span>
                {isActive && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">thinking…</span>
                )}
              </div>

              {/* Bullets */}
              {thought.bullets.length > 0 && (
                <ul className="flex flex-col gap-0.5 pl-0.5">
                  {thought.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 animate-in fade-in slide-in-from-left-1 duration-300"
                      style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
                    >
                      <span className="mt-1.5 size-1 rounded-full bg-muted-foreground/30 shrink-0" />
                      <span className="text-[12px] text-muted-foreground/75 leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

GenieThinkingSteps.displayName = "GenieThinkingSteps";
