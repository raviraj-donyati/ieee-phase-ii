"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown, Sun, Moon, MoreHorizontal, Pencil, Download, Trash2, MessageSquare, Loader2, CornerDownLeft, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chat, ChatMessage, Citation, Chatbot } from "@/types";
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

interface UserChatWindowProps {
  chatbot: Chatbot;
  chatbots: Chatbot[];
  chat: Chat | null;
  isLoading: boolean;
  streamingMessage: ChatMessage | null;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onOpenCitations: (citations: Citation[]) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSwitchChatbot: (chatbotId: string) => void;
}

export function UserChatWindow({
  chatbot, chatbots, chat, isLoading, streamingMessage, isStreaming,
  onSend, onOpenCitations, onRename, onDelete, onSwitchChatbot,
}: UserChatWindowProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [input, setInput] = useState("");
  const [prefillInput, setPrefillInput] = useState<string | undefined>();
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (!prefillInput) return;
    setInput(prefillInput);
    if (!autoSubmit) {
      setPrefillInput(undefined);
      setAutoSubmit(false);
      textareaRef.current?.focus();
      return;
    }
    if (isStreaming) return;
    onSend(prefillInput);
    setInput("");
    setPrefillInput(undefined);
    setAutoSubmit(false);
  }, [prefillInput, autoSubmit, isStreaming, onSend]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  }, [input, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !!input.trim() && !isStreaming;
  const username = session?.user?.name?.split(" ")[0] ?? "there";
  const showTabs = chatbots.length > 1;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
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
              <DropdownMenuItem onClick={() => {
                const next = window.prompt("Rename chat", chat.title);
                if (next?.trim()) onRename(chat.id, next.trim());
              }}>
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

      {/* Messages area */}
      <div className="relative min-h-0 flex-1">
        <div ref={viewportRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto overflow-x-hidden">
          {isLoading && !chat ? (
            <MessageSkeleton />
          ) : allMessages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center mx-auto w-full max-w-2xl px-4 py-12 gap-10">

              {/* Greeting */}
              <div className="space-y-1.5">
                <h1 className="font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
                  {getGreeting()}, {username} 👋
                </h1>
                <p className="text-muted-foreground text-base">
                  You have access to {chatbots.length} assistant{chatbots.length !== 1 ? "s" : ""}. Select one below and start chatting.
                </p>
              </div>

              {/* Chatbot info cards */}
              <div className="flex flex-col gap-3">
                {chatbots.map((bot) => {
                  const botMeta = agentMeta[bot.agentType] ?? agentMeta.ka;
                  const BotIcon = botMeta.icon;
                  const isActive = bot.id === chatbot.id;
                  return (
                    <div
                      key={bot.id}
                      className={cn(
                        "flex items-start gap-4 rounded-xl border bg-card px-4 py-4 transition-all",
                        isActive && "border-primary/25 bg-primary/[0.02]"
                      )}
                    >
                      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border overflow-hidden", botMeta.color)}>
                        {bot.logoUrl
                          ? <img src={bot.logoUrl} alt={bot.name} className="size-full object-cover" />
                          : <BotIcon className="size-5" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground">{bot.name}</p>
                          {isActive && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">
                          {bot.description ?? botMeta.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
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

      {/* Input area */}
      <div className="shrink-0 bg-background py-3 sm:py-4 px-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">

          {/* Input box — tabs sit inside the top border of the box */}
          <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">

            {/* Chatbot tabs — only when multiple bots */}
            {showTabs && (
              <div className="flex items-center gap-1 px-2 pt-2 pb-0">
                {chatbots.map((bot) => {
                  const botMeta = agentMeta[bot.agentType] ?? agentMeta.ka;
                  const BotIcon = botMeta.icon;
                  const isActive = bot.id === chatbot.id;
                  return (
                    <button
                      key={bot.id}
                      onClick={() => onSwitchChatbot(bot.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                        isActive
                          ? cn(botMeta.color)
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <span className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded overflow-hidden",
                        isActive ? botMeta.color : "text-muted-foreground"
                      )}>
                        {bot.logoUrl
                          ? <img src={bot.logoUrl} alt={bot.name} className="size-full object-cover" />
                          : <BotIcon className="size-3" />
                        }
                      </span>
                      <span className="truncate max-w-32">{bot.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Textarea */}
            <div className="flex flex-col border-t border-border/50">
              <textarea
                ref={textareaRef}
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                rows={1}
                className="field-sizing-content min-h-13 max-h-40 w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 border-0 outline-none ring-0 focus:ring-0 focus:outline-none"
              />
              <div className="flex justify-end px-2.5 py-2">
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  type="button"
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md transition-colors",
                    canSend
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  {isStreaming
                    ? <Loader2 className="size-4 animate-spin" />
                    : <CornerDownLeft className="size-4" />
                  }
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground/70">
            Responses are AI-generated and may not always be accurate.
          </p>
        </div>
      </div>
    </div>
  );
}
