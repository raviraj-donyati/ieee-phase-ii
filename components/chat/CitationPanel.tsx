"use client";

import { FileText, ExternalLink, X, BookOpen } from "lucide-react";
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

function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return ""; }
}

export function CitationPanel({ citations, onClose }: CitationPanelProps) {
  const sorted = citations
    .filter((c, i, arr) => arr.findIndex((x) => x.url === c.url) === i)
    .sort((a, b) => a.annotationIndex - b.annotationIndex);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3 shrink-0">
        <BookOpen className="size-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-sidebar-foreground flex-1">
          Sources
          {sorted.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-sidebar-foreground/50">
              — {sorted.length} reference{sorted.length !== 1 ? "s" : ""} found
            </span>
          )}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <BookOpen className="size-8 text-sidebar-foreground/15" />
            <div>
              <p className="text-sm font-medium text-sidebar-foreground/50">No sources</p>
              <p className="text-xs text-sidebar-foreground/30 mt-0.5">
                Citations appear here when the assistant responds.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-3 py-3 flex flex-col gap-2">
            {sorted.map((c, idx) => {
              const fileName = getFileName(c.url);
              const domain = getDomain(c.url);
              const pageLabel = c.startPageNumber != null
                ? c.startPageNumber === c.endPageNumber || !c.endPageNumber
                  ? `Page ${c.startPageNumber}`
                  : `Pages ${c.startPageNumber}–${c.endPageNumber}`
                : null;

              return (
                <a
                  key={`${c.url}-${c.annotationIndex}`}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 hover:border-primary/30 hover:bg-sidebar-accent/60 transition-all"
                >
                  {/* Index + title row */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5 leading-none">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-sidebar-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {c.title || fileName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {domain && (
                          <span className="text-xs text-sidebar-foreground/40 truncate">{domain}</span>
                        )}
                        {pageLabel && (
                          <>
                            <span className="text-sidebar-foreground/20 text-xs">·</span>
                            <span className="text-xs text-sidebar-foreground/40">{pageLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="size-3.5 shrink-0 text-sidebar-foreground/20 group-hover:text-primary/50 transition-colors mt-0.5" />
                  </div>

                  {/* Snippet */}
                  {c.snippet && (
                    <p className="text-xs text-sidebar-foreground/55 leading-relaxed line-clamp-15 pl-7 border-l-2 border-sidebar-border group-hover:border-primary/20 transition-colors">
                      {c.snippet}
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
