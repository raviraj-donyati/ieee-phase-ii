"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CitationPanel } from "@/components/chat/CitationPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChats } from "@/hooks/useChats";
import { readSSEStream } from "@/lib/stream-parser";
import { invokeEndpoint } from "@/lib/api";
import { ChatMessage, Citation, ChatMode, AgentSource, GenieThought } from "@/types";
import {
  isStreamingAtom,
  streamingMessageAtom,
  citationPanelOpenAtom,
  panelCitationsAtom,
} from "@/lib/atoms";

interface ChatLayoutProps {
  initialChatId?: string;
}

export function ChatLayout({ initialChatId }: ChatLayoutProps) {
  const isMobile = useIsMobile(1024);
  const { chats, isLoading, activeChat, activeChatId, setActiveChatId, createChat, removeChat, renameChat, addMessage, setGenieConversationId } =
    useChats("full");

  // Reset active chat when there is no initialChatId (new chat page).
  // This must NOT depend on `chats` — otherwise every addMessage/createChat
  // update would re-run this and wipe out the active chat mid-conversation.
  useEffect(() => {
    if (!initialChatId) {
      setActiveChatId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatId]);

  // Sync URL chat ID to atom once chats are loaded from DB
  const didSyncRef = useRef(false);
  useEffect(() => {
    if (!initialChatId) return;
    if (didSyncRef.current || chats.length === 0) return;
    didSyncRef.current = true;
    const exists = chats.find((c) => c.id === initialChatId);
    if (exists) {
      setActiveChatId(initialChatId);
    } else {
      window.history.replaceState(null, "", "/playground");
      setActiveChatId(null);
    }
  }, [chats, initialChatId, setActiveChatId]);

  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
  const [streamingMessage, setStreamingMessage] = useAtom(streamingMessageAtom);
  const [citationPanelOpen, setCitationPanelOpen] = useAtom(citationPanelOpenAtom);
  const [panelCitations, setPanelCitations] = useAtom(panelCitationsAtom);

  const activeChatIdRef = useRef<string | null>(activeChatId);
  activeChatIdRef.current = activeChatId;
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const handleSend = useCallback(
    async (content: string, endpoint: string, mode: ChatMode) => {
      let chatId = activeChatIdRef.current;
      if (!chatId) {
        const newChat = createChat();
        chatId = newChat.id;
        window.history.pushState(null, "", `/playground/${chatId}`);
      }

      await addMessage(chatId, {
        id: uuidv4(), role: "user", content, citations: [],
        createdAt: new Date().toISOString(),
      });
      setIsStreaming(true);

      if (mode === "genie") {
        const placeholder: ChatMessage = {
          id: uuidv4(), role: "assistant", content: "", citations: [], reasoning: "",
          createdAt: new Date().toISOString(),
        };
        setStreamingMessage(placeholder);
        let accContent = "", accReasoning = "";
        let genieSql = "", genieTableData: ChatMessage["tableData"] = undefined, genieSuggestions: string[] = [], genieMessageId = "", genieConversationId = "";
        const genieThoughts: GenieThought[] = [];
        const timingLogs: ChatMessage["timingLogs"] = [{ label: "Request sent", ts: Date.now() }];
        try {
          const res = await fetch("/api/genie-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spaceId: endpoint, content, conversationId: chatsRef.current.find((c) => c.id === chatId)?.genieConversationId }),
          });
          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");
          for await (const chunk of readSSEStream(reader)) {
            if (chunk.timingLog) timingLogs.push(chunk.timingLog);
            if (chunk.genieThought) {
              // Replace or append thought by thoughtType (idempotent on re-poll)
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
              if (chunk.genieDone.conversationId) { genieConversationId = chunk.genieDone.conversationId; setGenieConversationId(chatId, chunk.genieDone.conversationId); }
              if (chunk.genieDone.messageId) genieMessageId = chunk.genieDone.messageId;
              // Do NOT set tableData/sql on the streaming message — apply only at addMessage
              // so the table doesn't flash before the answer text arrives
            }
          }
          await addMessage(chatId, {
            ...placeholder, content: accContent, reasoning: accReasoning,
            genieThoughts: genieThoughts.length ? genieThoughts : undefined,
            sql: genieSql, tableData: genieTableData, suggestedQuestions: genieSuggestions,
            genieSpaceId: endpoint,
            genieConversationId: genieConversationId || undefined,
            genieMessageId: genieMessageId || undefined,
            timingLogs,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Genie error";
          toast.error(msg);
          await addMessage(chatId, { ...placeholder, content: `Error: ${msg}` });
        } finally {
          setStreamingMessage(null);
          setIsStreaming(false);
        }
        return;
      }

      const conversationId = uuidv4();
      const currentChat = chatsRef.current.find((c) => c.id === chatId);
      const history = [
        ...(currentChat?.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
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
      const timingLogs: ChatMessage["timingLogs"] = [{ label: "Request sent", ts: Date.now() }];

      try {
        const res = await invokeEndpoint(endpoint, history, conversationId, chatId);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        for await (const chunk of readSSEStream(reader)) {
          if (chunk.timingLog) timingLogs.push(chunk.timingLog);
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
            // Deduplicate by label+type
            if (!accSources.some((s) => s.label === chunk.agentSource!.label && s.type === chunk.agentSource!.type)) {
              accSources.push(chunk.agentSource);
            } else if (chunk.agentSource.detail) {
              // Update existing source with detail (e.g. SQL text)
              const idx = accSources.findIndex((s) => s.label === chunk.agentSource!.label && s.type === chunk.agentSource!.type);
              if (idx >= 0) accSources[idx] = { ...accSources[idx], detail: chunk.agentSource.detail };
            }
          }
          if (chunk.finalText !== undefined) {
            accContent = chunk.finalText;
            setStreamingMessage((p) => p ? { ...p, content: accContent } : p);
          }
        }
        await addMessage(chatId, { ...assistantMsg, content: accContent, reasoning: accReasoning, citations: accCitations, agentSources: accSources.length ? accSources : undefined, timingLogs });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        toast.error(msg);
        await addMessage(chatId, { ...assistantMsg, content: `Error: ${msg}` });
      } finally {
        setStreamingMessage(null);
        setIsStreaming(false);
      }
    },
    [createChat, addMessage, setIsStreaming, setStreamingMessage, setGenieConversationId]
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    window.history.pushState(null, "", "/playground");
    setStreamingMessage(null);
    setCitationPanelOpen(false);
    setPanelCitations([]);
  }, [setActiveChatId, setStreamingMessage, setCitationPanelOpen, setPanelCitations]);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    window.history.pushState(null, "", `/playground/${id}`);
  }, [setActiveChatId]);

  const handleDeleteChat = useCallback((id: string) => {
    const remaining = chats.filter((c) => c.id !== id);
    removeChat(id);
    if (activeChatId === id) {
      if (remaining.length > 0) {
        setActiveChatId(remaining[0].id);
        window.history.pushState(null, "", `/playground/${remaining[0].id}`);
      } else {
        setActiveChatId(null);
        window.history.pushState(null, "", "/playground");
      }
    }
  }, [removeChat, activeChatId, chats, setActiveChatId]);

  const handleOpenCitations = useCallback((citations: Citation[]) => {
    setPanelCitations(citations);
    setCitationPanelOpen(true);
  }, [setPanelCitations, setCitationPanelOpen]);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full overflow-hidden">
          <ChatSidebar
            chats={chats}
            isLoading={isLoading}
            activeChatId={activeChatId}
            onSelect={handleSelectChat}
            onCreate={handleNewChat}
            onDelete={handleDeleteChat}
            onRename={renameChat}
          />

          <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <ChatWindow
              chat={activeChat}
              isLoading={isLoading}
              streamingMessage={streamingMessage}
              isStreaming={isStreaming}
              onSend={handleSend}
              onOpenCitations={handleOpenCitations}
              onRename={renameChat}
              onDelete={handleDeleteChat}
            />
          </SidebarInset>

          {/* Desktop: side panel */}
          {citationPanelOpen && (
            <aside className="hidden lg:flex h-full w-72 shrink-0 flex-col border-l bg-sidebar overflow-hidden">
              <CitationPanel citations={panelCitations} onClose={() => setCitationPanelOpen(false)} />
            </aside>
          )}

          {/* Mobile: bottom sheet */}
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
