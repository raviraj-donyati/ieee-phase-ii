"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserChatSidebar } from "@/components/chat/UserChatSidebar";
import { CitationPanel } from "@/components/chat/CitationPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserChats } from "@/hooks/useUserChats";
import { readSSEStream } from "@/lib/stream-parser";
import { invokeEndpoint } from "@/lib/api";
import { ChatMessage, Citation, ChatMode, Chatbot, AgentSource } from "@/types";
import { citationPanelOpenAtom, panelCitationsAtom } from "@/lib/atoms";
import { UserChatWindow } from "@/components/chat/UserChatWindow";

interface UserChatLayoutProps {
  chatbots: Chatbot[];
  initialChatId?: string;
  isAdmin?: boolean;
}

export function UserChatLayout({ chatbots, initialChatId, isAdmin = false }: UserChatLayoutProps) {
  const isMobile = useIsMobile(1024);

  const [activeChatbotId, setActiveChatbotId] = useState<string>(chatbots[0]?.id ?? "");
  const activeChatbot = chatbots.find((b) => b.id === activeChatbotId) ?? chatbots[0];

  const {
    chats, isLoading, activeChat, activeChatId, setActiveChatId,
    startChat, addMessage, removeChat, renameChat, setGenieConversationId,
  } = useUserChats();

  // Streaming state is local — not global atoms.
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);

  // Citation panel stays global (shared with CitationPanel component).
  const [citationPanelOpen, setCitationPanelOpen] = useAtom(citationPanelOpenAtom);
  const [panelCitations, setPanelCitations] = useAtom(panelCitationsAtom);

  // Refs so async handleSend always reads latest values without stale closures.
  const activeChatIdRef = useRef<string | null>(activeChatId);
  activeChatIdRef.current = activeChatId;
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  // Sync initialChatId from URL once chats finish loading — runs once.
  const didSyncRef = useRef(false);
  useEffect(() => {
    if (!initialChatId || didSyncRef.current || isLoading) return;
    didSyncRef.current = true;
    const exists = chats.find((c) => c.id === initialChatId);
    if (exists) {
      setActiveChatId(initialChatId);
      if (exists.chatbotId) {
        const bot = chatbots.find((b) => b.id === exists.chatbotId);
        if (bot) setActiveChatbotId(bot.id);
      }
    } else {
      window.history.replaceState(null, "", "/chat");
    }
  }, [chats, isLoading, initialChatId, chatbots, setActiveChatId]);

  const handleSwitchChatbot = useCallback((chatbotId: string) => {
    setActiveChatbotId(chatbotId);
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeChatbot) return;
      const mode = activeChatbot.agentType as ChatMode;
      const endpoint = activeChatbot.agentId;

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content,
        citations: [],
        createdAt: new Date().toISOString(),
      };

      // Resolve or create the chat synchronously.
      let chatId = activeChatIdRef.current;
      if (!chatId) {
        // startChat: optimistic UI update + atomic API call (chat + message in one tx).
        chatId = startChat(userMessage, activeChatbot.id, activeChatbot.agentType, activeChatbot.agentId);
        window.history.pushState(null, "", `/chat/${chatId}`);
      } else {
        addMessage(chatId, userMessage);
      }

      setIsStreaming(true);

      // ── Genie path ──────────────────────────────────────────────────────────
      if (mode === "genie") {
        const placeholder: ChatMessage = {
          id: uuidv4(), role: "assistant", content: "", citations: [], reasoning: "",
          createdAt: new Date().toISOString(),
        };
        setStreamingMessage(placeholder);

        let accContent = "", accReasoning = "", genieSql = "", genieMessageId = "", genieConversationId = "";
        let genieTableData: ChatMessage["tableData"] = undefined;
        let genieSuggestions: string[] = [];

        try {
          const res = await fetch("/api/genie-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              spaceId: endpoint,
              content,
              conversationId: chatsRef.current.find((c) => c.id === chatId)?.genieConversationId,
            }),
          });
          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");

          for await (const chunk of readSSEStream(reader)) {
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
              if (chunk.genieDone.conversationId) {
                genieConversationId = chunk.genieDone.conversationId;
                setGenieConversationId(chatId!, chunk.genieDone.conversationId);
              }
              if (chunk.genieDone.messageId) genieMessageId = chunk.genieDone.messageId;
            }
          }

          addMessage(chatId!, {
            ...placeholder,
            content: accContent,
            reasoning: accReasoning,
            sql: genieSql,
            tableData: genieTableData,
            suggestedQuestions: genieSuggestions,
            genieSpaceId: endpoint,
            genieConversationId: genieConversationId || undefined,
            genieMessageId: genieMessageId || undefined,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Genie error";
          toast.error(msg);
          addMessage(chatId!, { ...placeholder, content: `Error: ${msg}` });
        } finally {
          setStreamingMessage(null);
          setIsStreaming(false);
        }
        return;
      }

      // ── KA / Supervisor path ─────────────────────────────────────────────────
      const conversationId = uuidv4();
      const currentChat = chatsRef.current.find((c) => c.id === chatId);
      const priorMessages = (currentChat?.messages ?? []).filter((m) => m.id !== userMessage.id);
      const history = [
        ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content },
      ];

      const assistantMsg: ChatMessage = {
        id: uuidv4(), role: "assistant", content: "", citations: [], reasoning: "",
        createdAt: new Date().toISOString(),
      };
      setStreamingMessage(assistantMsg);

      let accContent = "", accReasoning = "";
      const accCitations: Citation[] = [];
      const accSources: AgentSource[] = [];

      try {
        const res = await invokeEndpoint(endpoint, history, conversationId, chatId!);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        for await (const chunk of readSSEStream(reader)) {
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
          if (chunk.finalText !== undefined) {
            accContent = chunk.finalText;
            setStreamingMessage((p) => p ? { ...p, content: accContent } : p);
          }
          if (chunk.agentSource) {
            const src = chunk.agentSource;
            const idx = accSources.findIndex((s) => s.label === src.label && s.type === src.type);
            if (idx === -1) {
              accSources.push(src);
            } else if (src.detail) {
              accSources[idx] = { ...accSources[idx], detail: src.detail };
            }
          }
        }

        addMessage(chatId!, {
          ...assistantMsg,
          content: accContent,
          reasoning: accReasoning,
          citations: accCitations,
          agentSources: accSources.length ? accSources : undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        toast.error(msg);
        addMessage(chatId!, { ...assistantMsg, content: `Error: ${msg}` });
      } finally {
        setStreamingMessage(null);
        setIsStreaming(false);
      }
    },
    [activeChatbot, startChat, addMessage, setGenieConversationId],
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setStreamingMessage(null);
    setCitationPanelOpen(false);
    setPanelCitations([]);
    window.history.pushState(null, "", "/chat");
  }, [setActiveChatId, setCitationPanelOpen, setPanelCitations]);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    window.history.pushState(null, "", `/chat/${id}`);
    const chat = chatsRef.current.find((c) => c.id === id);
    if (chat?.chatbotId) {
      const bot = chatbots.find((b) => b.id === chat.chatbotId);
      if (bot) setActiveChatbotId(bot.id);
    }
  }, [setActiveChatId, chatbots]);

  const handleDeleteChat = useCallback((id: string) => {
    const remaining = chats.filter((c) => c.id !== id);
    removeChat(id);
    if (activeChatId === id) {
      const next = remaining[0] ?? null;
      setActiveChatId(next?.id ?? null);
      window.history.pushState(null, "", next ? `/chat/${next.id}` : "/chat");
    }
  }, [removeChat, activeChatId, chats, setActiveChatId]);

  const handleOpenCitations = useCallback((citations: Citation[]) => {
    setPanelCitations(citations);
    setCitationPanelOpen(true);
  }, [setPanelCitations, setCitationPanelOpen]);

  if (!activeChatbot) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        No chatbots available. Contact your admin.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full overflow-hidden">
          <UserChatSidebar
            chats={chats}
            chatbots={chatbots}
            isLoading={isLoading}
            activeChatId={activeChatId}
            onSelect={handleSelectChat}
            onCreate={handleNewChat}
            onDelete={handleDeleteChat}
            onRename={renameChat}
            isAdmin={isAdmin}
          />

          <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <UserChatWindow
              chatbot={activeChatbot}
              chatbots={chatbots}
              chat={activeChat}
              isLoading={isLoading}
              streamingMessage={streamingMessage}
              isStreaming={isStreaming}
              onSend={handleSend}
              onOpenCitations={handleOpenCitations}
              onRename={renameChat}
              onDelete={handleDeleteChat}
              onSwitchChatbot={handleSwitchChatbot}
            />
          </SidebarInset>

          {citationPanelOpen && (
            <aside className="hidden lg:flex h-full w-72 shrink-0 flex-col border-l bg-sidebar overflow-hidden">
              <CitationPanel citations={panelCitations} onClose={() => setCitationPanelOpen(false)} />
            </aside>
          )}

          <Sheet open={isMobile && citationPanelOpen} onOpenChange={setCitationPanelOpen}>
            <SheetContent side="bottom" aria-describedby={undefined} className="lg:hidden h-[70vh] p-0 rounded-t-xl gap-0 overflow-hidden flex flex-col">
              <VisuallyHidden><SheetTitle>Sources</SheetTitle></VisuallyHidden>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CitationPanel citations={panelCitations} onClose={() => setCitationPanelOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
