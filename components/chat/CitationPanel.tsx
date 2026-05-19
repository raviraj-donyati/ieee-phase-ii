"use client";

import { FileText, ExternalLink, X, BookOpen, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Citation } from "@/types";

interface CitationPanelProps {
  citations: Citation[];
  onClose?: () => void;
}

function getFileName(url: string) {
  try {
    return decodeURIComponent(url).split("/").pop()?.split("#")[0] || "Source";
  } catch { return "Source"; }
}

export function CitationPanel({ citations, onClose }: CitationPanelProps) {
  const sorted = citations
    .filter((c, i, arr) => arr.findIndex((x) => x.url === c.url) === i)
    .sort((a, b) => a.annotationIndex - b.annotationIndex);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-3.5 shrink-0">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="size-3.5" />
        </div>
        <h2 className="text-sm font-semibold text-sidebar-foreground flex-1">
          Sources
          {sorted.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-sidebar-foreground/50">
              ({sorted.length})
            </span>
          )}
        </h2>
        {onClose && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            className="size-7 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-sidebar-accent">
              <BookOpen className="size-5 text-sidebar-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-sidebar-foreground/70">No sources yet</p>
              <p className="text-xs text-sidebar-foreground/40 mt-1 leading-relaxed">
                Citations appear here as the assistant responds.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-4">
            {sorted.map((c) => {
              const fileName = getFileName(c.url);
              const pageLabel = c.startPageNumber != null
                ? c.startPageNumber === c.endPageNumber || !c.endPageNumber
                  ? `Page ${c.startPageNumber}`
                  : `Pages ${c.startPageNumber}–${c.endPageNumber}`
                : null;

              return (
                <div
                  key={`${c.url}-${c.annotationIndex}`}
                  className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3.5 flex flex-col gap-2.5 hover:border-primary/30 transition-colors"
                >
                  {/* Number + title */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                      {c.annotationIndex + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="size-3.5 shrink-0 text-sidebar-foreground/50" />
                        <span className="text-xs font-semibold text-sidebar-foreground truncate">
                          {c.title || fileName}
                        </span>
                      </div>
                      {pageLabel && (
                        <span className="text-[10px] text-sidebar-foreground/45 mt-0.5 block">
                          {pageLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Snippet */}
                  {c.snippet && (
                    <p className="text-[11px] text-sidebar-foreground/60 leading-relaxed line-clamp-3 pl-8">
                      {c.snippet}
                    </p>
                  )}

                  {/* Link */}
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors pl-8 w-fit"
                  >
                    <ExternalLink className="size-3" />
                    View source
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
