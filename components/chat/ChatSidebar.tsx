"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  Trash2, MoreHorizontal, Pencil, Download, LogOut,
  Check, X, MessageSquare, Zap, Plus, Search, Brain, Sparkles, Bot, LayoutDashboard,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Chat } from "@/types";

interface ChatbotInfo {
  name: string;
  description?: string | null;
  agentType: string;
}

const agentMeta: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  ka:         { icon: <Brain className="size-3.5" />,    label: "Knowledge Assistant", color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50" },
  genie:      { icon: <Sparkles className="size-3.5" />, label: "Genie Space",          color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50" },
  supervisor: { icon: <Bot className="size-3.5" />,      label: "Supervisor Agent",     color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50" },
};

interface ChatSidebarProps {
  chats: Chat[];
  isLoading: boolean;
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  chatbot?: ChatbotInfo;
  /** Override the "Back to Dashboard" link href. Pass null to hide it. */
  backHref?: string | null;
}

function UserFooter() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? email;
  const initials = name
    ? name.split(" ").map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("")
    : "?";

  return (
    <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center w-full">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none">
        {initials}
      </div>
      <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <span className="text-[13px] font-semibold text-sidebar-foreground truncate leading-none">{name}</span>
        <span className="text-[10px] text-sidebar-foreground/45 truncate mt-0.5 leading-none">{email}</span>
      </div>
      <div className="group-data-[collapsible=icon]:hidden flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2 py-2">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-8 rounded-lg bg-sidebar-accent/50 animate-pulse"
          style={{ width: `${60 + (i % 4) * 10}%`, opacity: 1 - i * 0.1 }}
        />
      ))}
    </div>
  );
}

function downloadChat(chat: Chat) {
  const lines: string[] = [`# ${chat.title}`, `Date: ${new Date(chat.createdAt).toLocaleString()}`, ""];
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

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "This Week";
  if (diffDays <= 30) return "This Month";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Older"];

export function ChatSidebar({
  chats, isLoading, activeChatId, onSelect, onCreate, onDelete, onRename, chatbot, backHref,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingId) inputRef.current?.focus(); }, [editingId]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const startRename = (chat: Chat) => { setEditingId(chat.id); setEditValue(chat.title); };
  const commitRename = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  const filtered = useMemo(() =>
    search.trim() ? chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) : chats,
    [chats, search]
  );

  const grouped = useMemo(() => {
    const map: Record<string, Chat[]> = {};
    for (const chat of filtered) {
      const g = getDateGroup(chat.createdAt);
      if (!map[g]) map[g] = [];
      map[g].push(chat);
    }
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({ label: g, chats: map[g] }));
  }, [filtered]);

  const meta = chatbot ? (agentMeta[chatbot.agentType] ?? agentMeta.ka) : null;

  return (
    <Sidebar collapsible="offcanvas">

      {/* ── Header ── */}
      <SidebarHeader className="px-3 pt-3 pb-2 border-b border-sidebar-border">

        {/* Brand */}
        <div className="flex items-center gap-2.5 pb-2">
          <div className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
            meta ? meta.color : "bg-primary text-primary-foreground"
          )}>
            {meta ? meta.icon : <Zap className="size-4" />}
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden min-w-0 flex-1">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">
              {chatbot?.name ?? "AI Platform"}
            </span>
            <span className="text-[10px] text-sidebar-foreground/40 mt-0.5">
              {meta ? meta.label : "Powered by Databricks"}
            </span>
          </div>
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(""); }}
            title="Search chats"
            className="group-data-[collapsible=icon]:hidden shrink-0 size-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          >
            <Search className="size-3.5" />
          </button>
        </div>

        {/* Chatbot description (if any) */}

        {/* Search bar */}
        {searchOpen && (
          <div className="group-data-[collapsible=icon]:hidden relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-sidebar-foreground/35 pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearch(""); } }}
              placeholder="Search conversations…"
              className="w-full rounded-lg bg-sidebar-accent/70 border border-sidebar-border focus:border-primary/40 focus:outline-none pl-8 pr-8 py-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/35 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/30 hover:text-sidebar-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        {/* New Chat button */}
        <button
          onClick={onCreate}
          className="group-data-[collapsible=icon]:hidden w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2.5 text-sm font-semibold transition-all shadow-sm"
        >
          <Plus className="size-4 shrink-0" />
          New Conversation
        </button>
      </SidebarHeader>

      {/* ── Chat list ── */}
      <SidebarContent className="px-2 gap-0 pt-1">
        {isLoading ? (
          <SidebarSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center group-data-[collapsible=icon]:hidden">
            <div className="size-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
              <MessageSquare className="size-5 text-sidebar-foreground/25" />
            </div>
            <p className="text-xs text-sidebar-foreground/40 leading-snug max-w-36">
              {search ? `No results for "${search}"` : "No conversations yet.\nStart a new chat above."}
            </p>
          </div>
        ) : (
          grouped.map(({ label, chats: groupChats }) => (
            <SidebarGroup key={label} className="py-1 px-0">
              <SidebarGroupLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 select-none">
                {label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {groupChats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      {editingId === chat.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(chat.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="flex-1 min-w-0 text-xs bg-sidebar-accent rounded-lg px-2.5 py-1.5 outline-none ring-1 ring-primary/40 text-sidebar-foreground"
                          />
                          <Button variant="ghost" size="icon-xs" onClick={() => commitRename(chat.id)} className="text-success hover:text-success hover:bg-transparent">
                            <Check className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(null)} className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-transparent">
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <SidebarMenuButton
                            isActive={activeChatId === chat.id}
                            onClick={() => onSelect(chat.id)}
                            tooltip={chat.title}
                            className={cn(
                              "h-8 rounded-lg px-2.5 text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent font-normal transition-all",
                              activeChatId === chat.id && "bg-sidebar-accent text-sidebar-foreground font-medium"
                            )}
                          >
                            <span className="truncate text-[12.5px] leading-none">{chat.title}</span>
                          </SidebarMenuButton>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction
                                showOnHover
                                className="rounded-md text-sidebar-foreground/35 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                title="More options"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start" className="w-44">
                              <DropdownMenuItem onClick={() => startRename(chat)}>
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
                        </>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="px-3 pt-2 pb-3 border-t border-sidebar-border gap-2">
        {chatbot && backHref !== null && (
          <Link
            href={backHref ?? "/dashboard"}
            className="group-data-[collapsible=icon]:hidden flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          >
            <LayoutDashboard className="size-3.5 shrink-0" />
            Back to Dashboard
          </Link>
        )}
        <UserFooter />
      </SidebarFooter>
    </Sidebar>
  );
}
