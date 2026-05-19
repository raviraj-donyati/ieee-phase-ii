"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown, Sparkles, Brain, Bot, MessageSquarePlus } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { Button } from "@/components/ui/button";
import { invokeEndpoint } from "@/lib/api";
import { readSSEStream } from "@/lib/stream-parser";
import { ChatMessage, Citation, ChatMode, AgentSource, GenieThought } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

const modeCards = [
  {
    id: "ka",
    icon: Brain,
    title: "Knowledge Assistant",
    description: "Ask questions against your internal knowledge bases. Best for policy, documentation, and structured data lookups.",
    color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
  },
  {
    id: "genie",
    icon: Sparkles,
    title: "Genie Space",
    description: "Run natural-language queries on Databricks Genie Spaces. Translates your question into SQL and returns live data.",
    color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50",
  },
  {
    id: "supervisor",
    icon: Bot,
    title: "Supervisor Agent",
    description: "Delegate complex, multi-step tasks to an AI agent that can plan, reason, and call tools on your behalf.",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50",
  },
];

export function PlaygroundWindow({ onClear, clearRef }: { onClear?: () => void; clearRef?: React.MutableRefObject<(() => void) | null> }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const allMessages = streamingMessage ? [...messages, streamingMessage] : messages;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTo({ top: vp.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [allMessages.length, streamingMessage?.content, streamingMessage?.reasoning, scrollToBottom]);

  const handleScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const dist = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
    setShowScrollBtn(dist > 120);
  };

  const handleSend = useCallback(async (content: string, endpoint: string, mode: ChatMode) => {
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content,
      citations: [],
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    if (mode === "genie") {
      const placeholder: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        citations: [],
        reasoning: "",
        createdAt: new Date().toISOString(),
      };
      setStreamingMessage(placeholder);

      let accContent = "", accReasoning = "";
      let genieSql = "", genieTableData: ChatMessage["tableData"] = undefined, genieSuggestions: string[] = [];
      const genieThoughts: GenieThought[] = [];
      const timingLogs: ChatMessage["timingLogs"] = [{ label: "Request sent", ts: Date.now() }];

      try {
        const res = await fetch("/api/genie-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaceId: endpoint, content }),
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        for await (const chunk of readSSEStream(reader)) {
          if (chunk.timingLog) {
            timingLogs.push(chunk.timingLog);
          }
          if (chunk.genieThought) {
            const idx = genieThoughts.findIndex((t) => t.thoughtType === chunk.genieThought!.thoughtType);
            if (idx >= 0) genieThoughts[idx] = chunk.genieThought;
            else genieThoughts.push(chunk.genieThought);
            setStreamingMessage((p) => p ? { ...p, genieThoughts: [...genieThoughts] } : p);
          }
          if (chunk.reasoningDelta) {
            accReasoning += chunk.reasoningDelta;
            setStreamingMessage((p) => p ? { ...p, reasoning: accReasoning } : p);
          }
          if (chunk.textDelta) {
            accContent += chunk.textDelta;
            setStreamingMessage((p) => p ? { ...p, content: accContent } : p);
          }
          if (chunk.genieDone) {
            genieSql = chunk.genieDone.sql;
            genieTableData = chunk.genieDone.tableData ?? undefined;
            genieSuggestions = chunk.genieDone.suggestedQuestions;
          }
        }

        timingLogs.push({ label: "Stream closed", ts: Date.now() });

        const finalMessage = {
          ...placeholder,
          content: accContent,
          reasoning: accReasoning,
          genieThoughts: genieThoughts.length ? genieThoughts : undefined,
          sql: genieSql,
          tableData: genieTableData,
          suggestedQuestions: genieSuggestions,
          genieSpaceId: endpoint,
          timingLogs,
        };

        setMessages(prev => [...prev, finalMessage]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Genie error";
        toast.error(msg);
        setMessages(prev => [...prev, { ...placeholder, content: `Error: ${msg}`, timingLogs }]);
      } finally {
        setStreamingMessage(null);
        setIsStreaming(false);
      }
      return;
    }

    // KA/Supervisor mode
    const conversationId = uuidv4();
    const history = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content },
    ];

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      citations: [],
      reasoning: "",
      createdAt: new Date().toISOString(),
    };
    setStreamingMessage(assistantMsg);

    let accContent = "", accReasoning = "";
    const accCitations: Citation[] = [];
    const accSources: AgentSource[] = [];
    const timingLogs: ChatMessage["timingLogs"] = [{ label: "Request sent", ts: Date.now() }];

    try {
      const res = await invokeEndpoint(endpoint, history, conversationId, "playground");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      for await (const chunk of readSSEStream(reader)) {
        if (chunk.timingLog) {
          timingLogs.push(chunk.timingLog);
        }
        if (chunk.textDelta) {
          accContent += chunk.textDelta;
          setStreamingMessage((p) => p ? { ...p, content: accContent } : p);
        }
        if (chunk.reasoningDelta) {
          accReasoning += chunk.reasoningDelta;
          setStreamingMessage((p) => p ? { ...p, reasoning: accReasoning } : p);
        }
        if (chunk.citation) {
          accCitations.push(chunk.citation);
          setStreamingMessage((p) => p ? { ...p, citations: [...accCitations] } : p);
        }
        if (chunk.agentSource) {
          if (!accSources.some((s) => s.label === chunk.agentSource!.label && s.type === chunk.agentSource!.type)) {
            accSources.push(chunk.agentSource);
          } else if (chunk.agentSource.detail) {
            const idx = accSources.findIndex((s) => s.label === chunk.agentSource!.label && s.type === chunk.agentSource!.type);
            if (idx >= 0) accSources[idx] = { ...accSources[idx], detail: chunk.agentSource.detail };
          }
        }
        if (chunk.finalText !== undefined) {
          accContent = chunk.finalText;
          setStreamingMessage((p) => p ? { ...p, content: accContent } : p);
        }
      }

      timingLogs.push({ label: "Stream closed", ts: Date.now() });

      setMessages(prev => [...prev, {
        ...assistantMsg,
        content: accContent,
        reasoning: accReasoning,
        citations: accCitations,
        agentSources: accSources.length ? accSources : undefined,
        timingLogs,
      }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stream error";
      toast.error(msg);
      setMessages(prev => [...prev, { ...assistantMsg, content: `Error: ${msg}`, timingLogs }]);
    } finally {
      setStreamingMessage(null);
      setIsStreaming(false);
    }
  }, [messages]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingMessage(null);
    onClear?.();
  }, [onClear]);

  // Register clear function with ref if provided
  useEffect(() => {
    if (clearRef) {
      clearRef.current = handleClear;
    }
  }, [clearRef, handleClear]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const username = session?.user?.name?.split(" ")[0] ?? "Admin";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Messages viewport */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-auto overflow-x-hidden"
        >
          {allMessages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center gap-8 max-w-5xl mx-auto w-full px-6 py-8">
              {/* Greeting */}
              <div className="space-y-2">
                <p className="font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
                  {getGreeting()}, {username} 👋
                </p>
                <p className="text-muted-foreground text-base sm:text-lg">
                  Test endpoints directly. No conversation history is saved.
                </p>
              </div>

              {/* Mode cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {modeCards.map(({ id, icon: Icon, title, description, color }) => (
                  <div key={id} className="rounded-xl border bg-card p-4 space-y-2.5 hover:border-primary/30 hover:shadow-sm transition-all">
                    <div className={`flex size-9 items-center justify-center rounded-lg border ${color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-1">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MessageSquarePlus className="size-3.5 shrink-0" />
                Playground mode — responses are not saved to your chat history.
              </p>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 py-4 pb-8 px-4 sm:px-6">
              <div className="mx-auto w-full max-w-5xl flex flex-col gap-2">
                {allMessages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={isStreaming && idx === allMessages.length - 1 && msg.role === "assistant"}
                    onSuggestedQuestion={() => {}} // No prefill in playground
                    onOpenCitations={() => {}} // No citation panel in playground
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {showScrollBtn && (
          <Button
            size="icon"
            variant="outline"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-10 size-9 bg-background/90 backdrop-blur-sm"
          >
            <ArrowDown className="size-4" />
          </Button>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
      />
    </div>
  );
}