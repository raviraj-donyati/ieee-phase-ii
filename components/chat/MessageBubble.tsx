"use client";

import { memo, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Copy, Check, BookOpen, FileText, ExternalLink, ChevronDown, ChevronRight, Code2, Table2, ThumbsUp, ThumbsDown, MessageSquareReply, Loader2, Database, Brain, Wrench } from "lucide-react";
import { Message, MessageContent, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {  CodeBlockContent, CodeBlockContainer, CodeBlockHeader, CodeBlockActions, CodeBlockCopyButton } from "@/components/ai-elements/code-block";
import { Streamdown, type ExtraProps } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { ChatMessage, Citation } from "@/types";
import { GenieThinkingSteps } from "@/components/ai-elements/genie-thinking-steps";
import type { AgentSource } from "@/types";

function parsePipeTable(text: string): { columns: string[]; rows: string[][] } | null {
  const lines = text.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;
  const columns = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
  const rows = lines.slice(2).map((l) => l.split("|").map((c) => c.trim()).filter(Boolean)).filter((r) => r.length > 0);
  return { columns, rows };
}

function AgentSourcesSection({ sources }: { sources: AgentSource[] }) {
  const [open, setOpen] = useState(false);

  // Deduplicate: merge sources with same label, preferring the one with detail (pipe-table)
  const merged = sources.reduce<AgentSource[]>((acc, src) => {
    const existing = acc.find((s) => s.label === src.label && s.type === src.type);
    if (existing) {
      if (src.detail && !existing.detail) existing.detail = src.detail;
      if (src.description && !existing.description) (existing as AgentSource & { description?: string }).description = src.description;
    } else {
      acc.push({ ...src });
    }
    return acc;
  }, []);

  // Only show sources that have actual data (detail) or a description
  const visible = merged.filter((s) => s.detail || (s as AgentSource & { description?: string }).description);
  if (visible.length === 0) return null;

  const icons: Record<AgentSource["type"], React.ReactNode> = {
    sql: <Database className="size-3.5 text-primary/70" />,
    kb: <Brain className="size-3.5 text-primary/70" />,
    tool: <Wrench className="size-3.5 text-primary/70" />,
  };
  const typeLabels: Record<AgentSource["type"], string> = {
    sql: "Data Query",
    kb: "Knowledge Base",
    tool: "Tool",
  };
  return (
    <div className="not-prose w-full rounded-md border border-border overflow-hidden">
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        className="w-full justify-start gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 h-auto rounded-t-md rounded-b-none"
      >
        <BookOpen className="size-3.5 text-primary/70" />
        <span>Data Sources ({visible.length})</span>
        {open ? <ChevronDown className="size-3 ml-auto" /> : <ChevronRight className="size-3 ml-auto" />}
      </Button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {visible.map((src, i) => {
            const desc = (src as AgentSource & { description?: string }).description;
            const table = src.detail ? parsePipeTable(src.detail) : null;
            const isSql = src.type === "sql" && src.detail && !src.detail.startsWith("|");
            return (
              <div key={i} className="px-3 py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {icons[src.type]}
                  <span className="text-[11px] font-semibold text-foreground">{src.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase tracking-wide">{typeLabels[src.type]}</span>
                </div>
                {desc && (
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic">{desc}</p>
                )}
                {table ? (
                  <div className="overflow-x-auto rounded border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {table.columns.map((col) => (
                            <TableHead key={col} className="whitespace-nowrap text-[10px] py-1 px-2">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.rows.slice(0, 10).map((row, ri) => (
                          <TableRow key={ri}>
                            {row.map((cell, ci) => (
                              <TableCell key={ci} className="whitespace-nowrap text-[10px] py-1 px-2">{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {table.rows.length > 10 && (
                      <p className="text-[10px] text-muted-foreground px-2 py-1">{table.rows.length - 10} more rows…</p>
                    )}
                  </div>
                ) : isSql ? (
                  <CodeBlockContainer language="sql" className="rounded border border-border text-[10px]">
                    <CodeBlockHeader>
                      <span className="text-[10px] text-muted-foreground font-mono">sql</span>
                      <CodeBlockActions><CodeBlockCopyButton className="size-5" /></CodeBlockActions>
                    </CodeBlockHeader>
                    <CodeBlockContent code={src.detail!} language="sql" className="whitespace-pre-wrap text-[10px]" />
                  </CodeBlockContainer>
                ) : src.detail ? (
                  <div className="prose prose-xs max-w-none text-[11px] text-muted-foreground">
                    <Streamdown mode="static" plugins={streamdownPlugins}>{src.detail}</Streamdown>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onSuggestedQuestion?: (q: string) => void;
  onOpenCitations?: (citations: Citation[]) => void;
}

function getFileName(url: string) {
  try {
    return decodeURIComponent(url).split("/").pop()?.split("#")[0] || "Source";
  } catch { return "Source"; }
}

function CitationBadge({ citation, onOpen }: { citation: Citation; onOpen?: () => void }) {
  const fileName = getFileName(citation.url);
  const pageLabel = citation.startPageNumber != null
    ? citation.startPageNumber === citation.endPageNumber || !citation.endPageNumber
      ? `Cited from page ${citation.startPageNumber}`
      : `Cited from pages ${citation.startPageNumber}–${citation.endPageNumber}`
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          onClick={onOpen}
          variant="link"
          className="h-auto p-0.5 font-medium text-primary hover:text-primary/70"
          style={{ fontSize: "0.7rem", verticalAlign: "super", lineHeight: 1 }}
        >
          {citation.annotationIndex + 1}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0 overflow-hidden z-50 bg-foreground gap-0 rounded-md">
        <div className="flex items-center gap-2 bg-foreground px-3 py-2">
          <FileText className="size-3.5 shrink-0 text-background/70" />
          <span className="text-xs font-semibold text-background truncate">{citation.title || fileName}</span>
        </div>
        {citation.snippet && (
          <div className="px-3 py-2 bg-foreground max-h-48 overflow-y-auto border-t border-background/10">
            <p className="text-[11px] text-background/80 leading-relaxed">{citation.snippet}</p>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 bg-foreground border-t border-background/10">
          {pageLabel && <span className="text-[10px] text-background/60">{pageLabel}</span>}
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
            className="ml-auto flex items-center gap-1 text-[11px] font-medium text-background/80 hover:text-background"
          >
            View PDF <ExternalLink className="size-3" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const streamdownPlugins = { cjk, code, math, mermaid };

function MessageWithCitations({
  content, citations, isStreaming, onOpenCitations,
}: {
  content: string;
  citations: Citation[];
  isStreaming: boolean;
  onOpenCitations?: () => void;
}) {
  const components = useMemo(() => ({
    sup: ({ children, node }: React.HTMLAttributes<HTMLElement> & ExtraProps) => {
      // rehype-sanitize/hast uses camelCase: data-cite → dataCite
      const raw = node?.properties?.dataCite;
      const idx = typeof raw === "string" || typeof raw === "number" ? String(raw) : undefined;
      const citation = idx !== undefined
        ? citations.find((c) => c.annotationIndex === parseInt(idx, 10))
        : undefined;
      if (citation) {
        return <CitationBadge citation={citation} onOpen={onOpenCitations} />;
      }
      return <sup>{children}</sup>;
    },
  }), [citations, onOpenCitations]);

  // Pre-process: replace [^key] markers with HTML <sup> tags Streamdown can render
  const processedContent = content
    .replace(/^\[\^[^\]]+\]:.*$(\n|$)/gm, "")  // strip footnote definitions
    .replace(/\[\^([^\]]+)\]/g, (_, key) => {
      const num = parseInt(key, 10);
      if (!isNaN(num)) {
        const c = citations.find((c) => c.annotationIndex === num - 1);
        return c ? `<sup data-cite="${c.annotationIndex}">${c.annotationIndex + 1}</sup>` : "";
      }
      const c = citations.find((c) => key.endsWith(`-${c.annotationIndex + 1}`));
      return c ? `<sup data-cite="${c.annotationIndex}">${c.annotationIndex + 1}</sup>` : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  const streamContent = content
    .replace(/^\[\^[^\]]+\]:.*$(\n|$)/gm, "")
    .replace(/\[\^[^\]]+\]/g, "");

  return (
    <Streamdown
      mode={isStreaming ? "streaming" : "static"}
      plugins={streamdownPlugins}
      components={components}
      allowedTags={{ sup: ["dataCite"] }}
      className="prose prose-sm max-w-none size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      {isStreaming ? streamContent : processedContent}
    </Streamdown>
  );
}

const FEEDBACK_KEY = "chat_feedback";
const THOUGHT_DURATION_KEY = "chat_thought_duration";

function getThoughtDuration(id: string): number | undefined {
  try {
    const val = JSON.parse(localStorage.getItem(THOUGHT_DURATION_KEY) || "{}")[id];
    return typeof val === "number" ? val : undefined;
  } catch { return undefined; }
}

function saveThoughtDuration(id: string, seconds: number) {
  try {
    const store = JSON.parse(localStorage.getItem(THOUGHT_DURATION_KEY) || "{}");
    store[id] = seconds;
    localStorage.setItem(THOUGHT_DURATION_KEY, JSON.stringify(store));
  } catch {}
}

function getFeedback(id: string): "up" | "down" | null {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}")[id] ?? null; } catch { return null; }
}

function setFeedback(id: string, value: "up" | "down" | null) {
  try {
    const store = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}");
    if (value === null) delete store[id]; else store[id] = value;
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(store));
  } catch {}
}

export const MessageBubble = memo(({ message, isStreaming, onSuggestedQuestion, onOpenCitations }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const [sqlOpen, setSqlOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedbackState] = useState<"up" | "down" | null>(
    () => message.genieFeedback?.rating ?? getFeedback(message.id)
  );
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState(message.genieFeedback?.comment ?? "");
  const [commentSent, setCommentSent] = useState(false);
  const [thoughtDuration, setThoughtDuration] = useState<number | undefined>(() => getThoughtDuration(message.id));
  const reasoningStartRef = useRef<number | null>(null);
  const isReasoningStreaming = !!isStreaming && !message.content;

  useEffect(() => {
    if (isReasoningStreaming) {
      if (reasoningStartRef.current === null) {
        reasoningStartRef.current = Date.now();
      }
    } else if (reasoningStartRef.current !== null) {
      const seconds = Math.ceil((Date.now() - reasoningStartRef.current) / 1000);
      reasoningStartRef.current = null;
      saveThoughtDuration(message.id, seconds);
      setThoughtDuration(seconds);
    }
  }, [isReasoningStreaming, message.id]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, []);

  const handleFeedback = useCallback((value: "up" | "down") => {
    const next = feedback === value ? null : value;
    setFeedbackState(next);
    setFeedback(message.id, next);

    const rating = next === "up" ? "POSITIVE" : next === "down" ? "NEGATIVE" : "NONE";
    fetch("/api/genie/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localMessageId: message.id,
        rating,
        comment: commentText.trim() || undefined,
        // Genie-only — undefined for KA/supervisor
        spaceId: message.genieSpaceId,
        conversationId: message.genieConversationId,
        messageId: message.genieMessageId,
      }),
    })
      .catch(() => {});
  }, [feedback, commentText, message.id, message.genieSpaceId, message.genieConversationId, message.genieMessageId]);

  const handleComment = useCallback(() => {
    if (!commentText.trim()) return;
    const rating = feedback === "up" ? "POSITIVE" : feedback === "down" ? "NEGATIVE" : "NONE";
    fetch("/api/genie/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localMessageId: message.id,
        rating,
        comment: commentText.trim(),
        spaceId: message.genieSpaceId,
        conversationId: message.genieConversationId,
        messageId: message.genieMessageId,
      }),
    }).catch(console.error);
    setCommentSent(true);
    setTimeout(() => { setCommentOpen(false); setCommentSent(false); }, 1500);
  }, [feedback, commentText, message.id, message.genieSpaceId, message.genieConversationId, message.genieMessageId]);

  const thoughtScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (thoughtScrollRef.current) {
      thoughtScrollRef.current.scrollTop = thoughtScrollRef.current.scrollHeight;
    }
  }, [message.genieThoughts?.length, message.reasoning]);

  const hasReasoning = !!message.reasoning && message.reasoning.trim().length > 0;
  const hasGenieThoughts = !!message.genieSpaceId && ((message.genieThoughts?.length ?? 0) > 0 || !!isStreaming);
  const showReasoningBlock = hasGenieThoughts || hasReasoning;

  // True during the silent gap before any reasoning or text has arrived
  const isWaiting = !!isStreaming && !message.content && !hasReasoning && !hasGenieThoughts;

  const uniqueCitations = message.citations
    .filter((c, i, arr) => arr.findIndex((x) => x.url === c.url) === i)
    .sort((a, b) => a.annotationIndex - b.annotationIndex);

  const timeLabel = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const timeFull = message.createdAt ? new Date(message.createdAt).toLocaleString() : "";

  return (
    <div className="w-full ">
      <Message from={isUser ? "user" : "assistant"} className="max-w-full">
        {isUser ? (
          <div className="flex flex-col items-end gap-1 ml-auto group/msg">
            <MessageContent className="max-w-full overflow-visible">
              <span className="whitespace-pre-wrap text-sm">{message.content}</span>
            </MessageContent>
            <MessageActions className="shrink-0">
              <MessageAction tooltip={copied ? "Copied!" : "Copy message"} onClick={() => handleCopy(message.content)} className={copied ? "text-success hover:text-success" : ""}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </MessageAction>
              {timeLabel && (
                <span title={timeFull} className="flex items-center gap-1 text-sm text-muted-foreground pl-1">
                  {timeLabel}
                </span>
              )}
            </MessageActions>
          </div>
        ) : (
        <MessageContent className="max-w-full overflow-visible">

          {/* Silent-gap waiting state: show the same Thinking... header, no content */}
          {isWaiting && (
            <Reasoning isStreaming={true}>
              <ReasoningTrigger />
            </Reasoning>
          )}

          {!isUser && !isWaiting && showReasoningBlock && (
            <Reasoning isStreaming={isReasoningStreaming} duration={thoughtDuration}>
              <ReasoningTrigger />
              <CollapsibleContent className="mt-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <div ref={thoughtScrollRef} className="max-h-72 overflow-y-auto pr-1">
                  {hasGenieThoughts ? (
                    <GenieThinkingSteps
                      thoughts={message.genieThoughts ?? []}
                      isStreaming={!!isStreaming && !message.content}
                    />
                  ) : (
                    (message.reasoning ?? "").split("\n").filter(l => l.trim()).map((line, i, arr) => {
                      const isLast = i === arr.length - 1;
                      const isOngoing = !!isStreaming && !message.content && isLast;
                      return (
                        <div key={i} className="flex gap-2.5 items-start">
                          <div className="relative flex flex-col items-center shrink-0 self-stretch" style={{ width: 10 }}>
                            <div className={["size-2 rounded-full shrink-0 transition-colors mt-1.25", isOngoing ? "bg-muted-foreground/40 animate-pulse" : "bg-success"].join(" ")} />
                            {i < arr.length - 1 && (
                              <div className={["w-px flex-1 mt-1 transition-colors", isOngoing ? "bg-border" : "bg-success/40"].join(" ")} />
                            )}
                          </div>
                          <p className={["pb-2 leading-relaxed text-[13px]", isOngoing ? "text-muted-foreground" : "text-muted-foreground/75"].join(" ")}>{line}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Reasoning>
          )}

          {!isWaiting && (
            <MessageWithCitations
              content={message.content}
              citations={uniqueCitations}
              isStreaming={!!isStreaming}
            />
          )}

          {!isUser && message.agentSources && message.agentSources.length > 0 && (
            <AgentSourcesSection sources={message.agentSources} />
          )}

          {!isUser && message.sql && (
            <div className="not-prose w-full rounded-md border border-border overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => setSqlOpen((o) => !o)}
                className="w-full justify-start gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 h-auto rounded-t-md rounded-b-none"
              >
                <Code2 className="size-3.5 text-primary/70" />
                <span>View SQL Query</span>
                {sqlOpen ? <ChevronDown className="size-3 ml-auto" /> : <ChevronRight className="size-3 ml-auto" />}
              </Button>
              {sqlOpen && (
                <CodeBlockContainer language="sql" className="rounded-none border-0 border-t">
                  <CodeBlockHeader>
                    <span className="text-xs text-muted-foreground font-mono">sql</span>
                    <CodeBlockActions>
                      <CodeBlockCopyButton className="size-6" />
                    </CodeBlockActions>
                  </CodeBlockHeader>
                  <CodeBlockContent code={message.sql} language="sql" className="whitespace-pre-wrap" />
                </CodeBlockContainer>
              )}
            </div>
          )}

          {!isUser && message.tableData && message.tableData.rows.length > 0 && (
            <div className="not-prose w-full rounded-md border border-border overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => setTableOpen((o) => !o)}
                className="w-full justify-start gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 h-auto rounded-t-md rounded-b-none"
              >
                <Table2 className="size-3.5 text-primary/70" />
                <span>View Results ({message.tableData.rows.length} rows)</span>
                {tableOpen ? <ChevronDown className="size-3 ml-auto" /> : <ChevronRight className="size-3 ml-auto" />}
              </Button>
              {tableOpen && (() => {
                const PAGE_SIZE = 20;
                const totalPages = Math.ceil(message.tableData!.rows.length / PAGE_SIZE);
                const pageRows = message.tableData!.rows.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);
                return (
                  <div className="border-t border-border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {message.tableData!.columns.map((col) => (
                            <TableHead key={col} className="whitespace-nowrap text-xs">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((row, i) => (
                          <TableRow key={i}>
                            {row.map((cell, j) => (
                              <TableCell key={j} className="whitespace-nowrap text-xs">{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/20">
                        <span className="text-[10px] text-muted-foreground">
                          Rows {tablePage * PAGE_SIZE + 1}–{Math.min((tablePage + 1) * PAGE_SIZE, message.tableData!.rows.length)} of {message.tableData!.rows.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={tablePage === 0}
                            onClick={() => setTablePage((p) => p - 1)}
                          >Prev</Button>
                          <span className="text-[10px] text-muted-foreground">{tablePage + 1}/{totalPages}</span>
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={tablePage >= totalPages - 1}
                            onClick={() => setTablePage((p) => p + 1)}
                          >Next</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </MessageContent>
        )}

        {!isUser && message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-primary/20">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
            {message.suggestedQuestions.map((q, i) => (
              <Badge
                key={i}
                variant="outline"
                asChild
                className="h-auto rounded-md px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
              >
                <button onClick={() => onSuggestedQuestion?.(q)}>{q}</button>
              </Badge>
            ))}
            </div>
          </div>
        )}

        {!isUser && message.content && !isStreaming && (
          <MessageActions className="mt-1">
            {timeLabel && (
              <span title={timeFull} className="flex items-center gap-1 text-sm text-muted-foreground pr-1">
               {timeLabel}
              </span>
            )}
            <MessageAction tooltip={copied ? "Copied!" : "Copy response"} onClick={() => handleCopy(message.content)} className={copied ? "text-success hover:text-success" : ""}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </MessageAction>
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
              </span>
            )}
            <MessageAction tooltip="Good response" onClick={() => handleFeedback("up")} className={feedback === "up" ? "text-success hover:text-success" : ""}>
              <ThumbsUp className="size-3.5" style={feedback === "up" ? { stroke: "#22c55e" } : undefined} />
            </MessageAction>
            <MessageAction tooltip="Bad response" onClick={() => handleFeedback("down")} className={feedback === "down" ? "text-destructive hover:text-destructive" : ""}>
              <ThumbsDown className="size-3.5" style={feedback === "down" ? { stroke: "#ef4444" } : undefined} />
            </MessageAction>
            <MessageAction tooltip={commentText ? "Edit comment" : "Add comment"} onClick={() => setCommentOpen(true)}>
              <MessageSquareReply className={`size-3.5 ${commentText ? "text-primary" : ""}`} />
            </MessageAction>
            <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
              <DialogContent className="sm:max-w-md rounded-md">
                <DialogHeader>
                  <DialogTitle>{commentText ? "Edit comment" : "Add a comment"}</DialogTitle>
                </DialogHeader>
                <Textarea
                  rows={4}
                  maxLength={5000}
                  placeholder="Share feedback about this response…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="resize-none"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCommentOpen(false)}>Cancel</Button>
                  <Button onClick={handleComment} disabled={!commentText.trim()}>
                    {commentSent ? "Sent!" : commentText ? "Update" : "Send"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {uniqueCitations.length > 0 && (
              <MessageAction
                tooltip="View sources"
                onClick={() => onOpenCitations?.(uniqueCitations)}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-sm text-primary/70 hover:text-primary"
              >
                <BookOpen className="size-3.5" />
                {uniqueCitations.length} sources
              </MessageAction>
            )}
          </MessageActions>
        )}
      </Message>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";
