"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Trash2, MoreHorizontal, Pencil, LogOut,
  Check, X, MessageSquare, Plus, Search, Brain, Sparkles, Bot, BrainCircuit, FlaskConical,
} from "lucide-react";
import Link from "next/link";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Chat, Chatbot } from "@/types";

const agentMeta: Record<string, { icon: React.ElementType; color: string }> = {
  ka:         { icon: Brain,    color: "text-blue-500 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
  genie:      { icon: Sparkles, color: "text-purple-500 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/40" },
  supervisor: { icon: Bot,      color: "text-emerald-500 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40" },
};

interface UserChatSidebarProps {
  chats: Chat[];
  chatbots: Chatbot[];
  isLoading: boolean;
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isAdmin?: boolean;
}

function UserFooter({ isAdmin }: { isAdmin: boolean }) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? email;
  const initials = name
    ? name.split(" ").map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("")
    : "?";

  return (
    <div className="flex items-center gap-2.5 w-full group-data-[collapsible=icon]:justify-center">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground text-sm font-semibold select-none">
        {initials}
      </div>
      <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-sidebar-foreground truncate leading-none">{name}</span>
          {isAdmin && (
            <span className="shrink-0 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary border border-primary/25 leading-none">
              Admin
            </span>
          )}
        </div>
        <span className="text-xs text-sidebar-foreground/40 truncate mt-0.5 leading-none">{email}</span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        title="Sign out"
        className="group-data-[collapsible=icon]:hidden shrink-0 p-1 rounded-md text-sidebar-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      {[80, 60, 72, 55, 68, 50].map((w, i) => (
        <div key={i} className="h-7 rounded-md bg-sidebar-accent/40 animate-pulse" style={{ width: `${w}%`, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

function getDateGroup(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "This week";
  if (diffDays <= 30) return "This month";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "This week", "This month", "Older"];

export function UserChatSidebar({
  chats, chatbots, isLoading, activeChatId, onSelect, onCreate, onDelete, onRename, isAdmin = false,
}: UserChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingId) inputRef.current?.focus(); }, [editingId]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const commitRename = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  const chatbotMap = useMemo(() => {
    const map = new Map<string, Chatbot>();
    for (const bot of chatbots) map.set(bot.id, bot);
    return map;
  }, [chatbots]);  const filtered = useMemo(() =>
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

  return (
    <Sidebar collapsible="offcanvas">

      {/* Header */}
      <SidebarHeader className="px-3 py-3 gap-2">

        {/* Brand */}
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden pb-1">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BrainCircuit className="size-4" />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">Assessment</span>
            <span className="text-xs text-sidebar-foreground/40 leading-none mt-0.5">Phase 2</span>
          </div>
        </div>

        {/* New conversation + search toggle */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
          <button
            onClick={onCreate}
            className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all border border-dashed border-sidebar-border hover:border-sidebar-border/80"
          >
            <Plus className="size-3.5 shrink-0" />
            New conversation
          </button>
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(""); }}
            title="Search chats"
            className={cn(
              "shrink-0 size-8 flex items-center justify-center rounded-lg border transition-all",
              searchOpen
                ? "bg-sidebar-accent text-sidebar-foreground border-sidebar-border"
                : "text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent border-transparent"
            )}
          >
            <Search className="size-3.5" />
          </button>
        </div>

        {/* Search bar — shown on toggle */}
        {searchOpen && (
          <div className="relative group-data-[collapsible=icon]:hidden">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-sidebar-foreground/30 pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearch(""); } }}
              placeholder="Search conversations…"
              className="w-full rounded-lg bg-sidebar-accent/50 border-0 focus:outline-none focus:ring-1 focus:ring-sidebar-border pl-8 pr-8 py-1.5 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/30 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/30 hover:text-sidebar-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
      </SidebarHeader>

      {/* Chat list */}
      <SidebarContent className="px-2 gap-0">
        {isLoading ? (
          <SidebarSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center group-data-[collapsible=icon]:hidden">
            <MessageSquare className="size-6 text-sidebar-foreground/15" />
            <p className="text-xs text-sidebar-foreground/30">
              {search ? `No results for "${search}"` : "No conversations yet"}
            </p>
          </div>
        ) : (
          grouped.map(({ label, chats: groupChats }) => (
            <SidebarGroup key={label} className="py-2 px-0">
              <p className="px-2 pb-1 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider select-none">
                {label}
              </p>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {groupChats.map((chat) => {
                    const isActive = activeChatId === chat.id;

                    return (
                      <SidebarMenuItem key={chat.id}>
                        {editingId === chat.id ? (
                          <div className="flex items-center gap-1 px-1 py-0.5">
                            <input
                              ref={inputRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(chat.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 min-w-0 text-xs bg-sidebar-accent rounded-md px-2 py-1.5 outline-none ring-1 ring-primary/30 text-sidebar-foreground"
                            />
                            <button onClick={() => commitRename(chat.id)} className="p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground">
                              <Check className="size-3" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground">
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => onSelect(chat.id)}
                              tooltip={chat.title}
                              className={cn(
                                "h-8 rounded-md px-2 gap-1.5 font-normal transition-all",
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-foreground"
                                  : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                              )}
                            >
                              <span className="truncate text-sm">{chat.title}</span>
                            </SidebarMenuButton>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuAction
                                  showOnHover
                                  className="rounded text-sidebar-foreground/25 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                >
                                  <MoreHorizontal className="size-3" />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start" className="w-36">
                                <DropdownMenuItem onClick={() => { setEditingId(chat.id); setEditValue(chat.title); }}>
                                  <Pencil className="size-3 mr-2" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(chat.id)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="size-3 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border">
        {isAdmin && (
          <Link
            href="/admin/playground"
            className="group-data-[collapsible=icon]:hidden flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all mb-1"
          >
            <FlaskConical className="size-3.5 shrink-0 text-primary/60" />
            Admin Playground
          </Link>
        )}
        <UserFooter isAdmin={isAdmin} />
      </SidebarFooter>
    </Sidebar>
  );
}
