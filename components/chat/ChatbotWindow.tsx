"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown, Sun, Moon, MoreHorizontal, Pencil, Download, Trash2, ArrowLeft, MessageSquare } from "lucide-react";
import { useTheme } from "next-themes";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatbotInput } from "@/components/chat/ChatbotInput";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chat, ChatMessage, Citation, Chatbot } from "@/types";
import Link from "next/link";
import { agentMeta } from "@/lib/starter-prompts";

function downloadChat(chat: Chat) {
  const lines: string[] = [`# ${chat.title}`, `Date: ${new Date(chat.createdAt).toLocaleString()}`, ""];
  for (const msg of chat.messages) {
    lines.push(`**${msg.role === "user" ? "You" : "Assistant"}** (${new Date(msg.createdAt).toLocaleTimeString()})`);
    lines.push(msg.content);
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${chat.title.replace(/[^a-z0-9]/gi, "_")}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-6 px-3 sm:px-4 max-w-3xl mx-auto w-full">
      <div className="flex justify-end"><div className="h-9 w-48 rounded-2xl bg-primary/10 animate-pulse" /></div>
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-3/4 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-5/6 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}

interface ChatbotWindowProps {
  chatbot: Chatbot;
  chat: Chat | null;
  isLoading: boolean;
  streamingMessage: ChatMessage | null;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onOpenCitations: (citations: Citation[]) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ChatbotWindow({
  chatbot, chat, isLoading, streamingMessage, isStreaming, onSend, onOpenCitations, onRename, onDelete,
}: ChatbotWindowProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [prefillInput, setPrefillInput] = useState<string | undefined>();
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const messages = chat?.messages ?? [];
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
    setShowScrollBtn(vp.scrollHeight - vp.scrollTop - vp.clientHeight > 120);
  };

  const username = session?.user?.name?.split(" ")[0] ?? "there";
  const meta = agentMeta[chatbot.agentType] ?? agentMeta.ka;
  const MetaIcon = meta.icon;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="shrink-0" />
        <Link href="/dashboard" className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Back to dashboard">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border", meta.color)}>
            <MetaIcon className="size-3.5" />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">
            {chat?.title ?? chatbot.name}
          </span>
        </div>

        {chat && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => { const next = window.prompt("Rename chat", chat.title); if (next?.trim()) onRename(chat.id, next.trim()); }}>
                <Pencil className="size-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadChat(chat)}>
                <Download className="size-3.5 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(chat.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={viewportRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto overflow-x-hidden">
          {isLoading && !chat ? (
            <MessageSkeleton />
          ) : allMessages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center mx-auto w-full max-w-3xl px-3 sm:px-4 py-12 gap-8">

              {/* Identity block */}
              <div className="flex flex-col gap-4">
                <div className={cn("flex size-14 items-center justify-center rounded-2xl border-2 shadow-sm", meta.color)}>
                  <MetaIcon className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Hi {username}, I&apos;m {chatbot.name}
                  </h1>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.color)}>
                    <MetaIcon className="size-3" />
                    {meta.label}
                  </span>
                  {chatbot.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed pt-0.5 max-w-lg">
                      {chatbot.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Starter prompts */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Try asking</p>
                <div className="flex flex-col gap-2">
                  {meta.starters.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setPrefillInput(prompt); setAutoSubmit(true); }}
                      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm text-foreground hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-sm transition-all group"
                    >
                      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 py-4 pb-8 px-3 sm:px-4">
              <div className="mx-auto w-full max-w-3xl flex flex-col gap-2">
                {allMessages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={isStreaming && idx === allMessages.length - 1 && msg.role === "assistant"}
                    onSuggestedQuestion={(q) => { setPrefillInput(q); setAutoSubmit(true); }}
                    onOpenCitations={onOpenCitations}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {showScrollBtn && (
          <Button size="icon" variant="outline" onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md z-10 size-9 bg-background/90 backdrop-blur-sm">
            <ArrowDown className="size-4" />
          </Button>
        )}
      </div>

      <ChatbotInput
        onSend={(content) => onSend(content)}
        isStreaming={isStreaming}
        agentType={chatbot.agentType as import("@/types").ChatMode}
        agentId={chatbot.agentId}
        prefillInput={prefillInput}
        autoSubmit={autoSubmit}
        onPrefillConsumed={() => { setPrefillInput(undefined); setAutoSubmit(false); }}
      />
    </div>
  );
}
