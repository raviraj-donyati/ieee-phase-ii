"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown, Sun, Moon, MoreHorizontal, Pencil, Download, Trash2, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chat, ChatMessage, Citation, ChatMode } from "@/types";
import { modeCards } from "@/lib/starter-prompts";

function downloadChat(chat: Chat) {
  const lines: string[] = [
    `# ${chat.title}`,
    `Date: ${new Date(chat.createdAt).toLocaleString()}`,
    "",
  ];
  for (const msg of chat.messages) {
    lines.push(`**${msg.role === "user" ? "You" : "Assistant"}** (${new Date(msg.createdAt).toLocaleTimeString()})`);
    lines.push(msg.content);
    if (msg.sql) { lines.push("```sql"); lines.push(msg.sql); lines.push("```"); }
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
    <div className="flex flex-col gap-8 py-8 px-4 max-w-3xl mx-auto w-full">
      <div className="flex justify-end">
        <div className="h-10 w-52 rounded-2xl bg-primary/10 animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-3/4 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-full rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-5/6 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-2/3 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}

interface ChatWindowProps {
  chat: Chat | null;
  isLoading: boolean;
  streamingMessage: ChatMessage | null;
  isStreaming: boolean;
  onSend: (content: string, endpoint: string, mode: ChatMode) => void;
  onOpenCitations: (citations: Citation[]) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ChatWindow({
  chat, isLoading, streamingMessage, isStreaming, onSend, onOpenCitations, onRename, onDelete,
}: ChatWindowProps) {
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
    const dist = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
    setShowScrollBtn(dist > 120);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const username = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="truncate text-sm font-semibold text-foreground">
            {chat?.title ?? "New conversation"}
          </span>
        </div>

        {chat && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" title="Chat options">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => {
                const next = window.prompt("Rename chat", chat.title);
                if (next?.trim()) onRename(chat.id, next.trim());
              }}>
                <Pencil className="size-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadChat(chat)}>
                <Download className="size-3.5 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(chat.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          title="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>

      {/* ── Messages viewport ── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-auto overflow-x-hidden"
        >
          {isLoading && !chat ? (
            <MessageSkeleton />
          ) : allMessages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center mx-auto w-full max-w-5xl px-3 sm:px-4 py-12 gap-10">

              {/* Greeting */}
              <div className="space-y-1.5">
                <h1 className="font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
                  {getGreeting()}, {username} 👋
                </h1>
                <p className="text-muted-foreground text-base">
                  What would you like to explore today?
                </p>
              </div>

              {/* Mode cards */}
              <div className="flex flex-col gap-2.5">
                {modeCards.map(({ id, icon: Icon, title, description, color, prompt }) => (
                  <button
                    key={id}
                    onClick={() => { setPrefillInput(prompt); }}
                    className="group flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 text-left hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-sm transition-all"
                  >
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", color)}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{description}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary/50 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground/60 text-center">
                Responses are AI-generated and may not always be accurate.
              </p>
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
                    onOpenCitations={(citations) => onOpenCitations(citations)}
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
        onSend={onSend}
        isStreaming={isStreaming}
        prefillInput={prefillInput}
        autoSubmit={autoSubmit}
        onPrefillConsumed={() => { setPrefillInput(undefined); setAutoSubmit(false); }}
      />
    </div>
  );
}
