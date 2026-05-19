"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { CitationPanel } from "@/components/chat/CitationPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatbotChats } from "@/hooks/useChatbotChats";
import { readSSEStream } from "@/lib/stream-parser";
import { invokeEndpoint } from "@/lib/api";
import { ChatMessage, Citation, ChatMode, Chatbot, AgentSource } from "@/types";
import {
  isStreamingAtom, streamingMessageAtom, citationPanelOpenAtom, panelCitationsAtom,
} from "@/lib/atoms";
import { ChatbotWindow } from "@/components/chat/ChatbotWindow";

interface ChatbotChatLayoutProps {
  chatbot: Chatbot;
  initialChatId?: string;
}

export function ChatbotChatLayout({ chatbot, initialChatId }: ChatbotChatLayoutProps) {
  const isMobile = useIsMobile(1024);
  const { chats, isLoading, activeChat, activeChatId, setActiveChatId, createChat, removeChat, renameChat, addMessage, setGenieConversationId } =
    useChatbotChats(chatbot.id);

  const basePath = `/c/${chatbot.id}`;

  useEffect(() => {
    if (!initialChatId) setActiveChatId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatId]);

  const didSyncRef = useRef(false);
  useEffect(() => {
    if (!initialChatId) return;
    if (didSyncRef.current || chats.length === 0) return;
    didSyncRef.current = true;
    const exists = chats.find((c) => c.id === initialChatId);
    if (exists) setActiveChatId(initialChatId);
    else { window.history.replaceState(null, "", basePath); setActiveChatId(null); }
  }, [chats, initialChatId, setActiveChatId, basePath]);

  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
  const [streamingMessage, setStreamingMessage] = useAtom(streamingMessageAtom);
  const [citationPanelOpen, setCitationPanelOpen] = useAtom(citationPanelOpenAtom);
  const [panelCitations, setPanelCitations] = useAtom(panelCitationsAtom);

  const activeChatIdRef = useRef<string | null>(activeChatId);
  activeChatIdRef.current = activeChatId;
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const handleSend = useCallback(
    async (content: string) => {
      const mode = chatbot.agentType as ChatMode;
      const endpoint = chatbot.agentId;

      let chatId = activeChatIdRef.current;
      if (!chatId) {
        const newChat = createChat();
        chatId = newChat.id;
        window.history.pushState(null, "", `${basePath}/${chatId}`);
      }

      await addMessage(chatId, { id: uuidv4(), role: "user", content, citations: [], createdAt: new Date().toISOString() });
      setIsStreaming(true);

      if (mode === "genie") {
        const placeholder: ChatMessage = { id: uuidv4(), role: "assistant", content: "", citations: [], reasoning: "", createdAt: new Date().toISOString() };
        setStreamingMessage(placeholder);
        let accContent = "", accReasoning = "", genieSql = "", genieMessageId = "", genieConversationId = "";
        let genieTableData: ChatMessage["tableData"] = undefined, genieSuggestions: string[] = [];
        try {
          const res = await fetch("/api/genie-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spaceId: endpoint, content, conversationId: chatsRef.current.find((c) => c.id === chatId)?.genieConversationId }),
          });
          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");
          for await (const chunk of readSSEStream(reader)) {
            if (chunk.reasoningDelta) { accReasoning += chunk.reasoningDelta; setStreamingMessage((p) => p ? { ...p, reasoning: accReasoning } : p); }
            if (chunk.textDelta) { accContent += chunk.textDelta; setStreamingMessage((p) => p ? { ...p, content: accContent } : p); }
            if (chunk.genieDone) {
              genieSql = chunk.genieDone.sql;
              genieTableData = chunk.genieDone.tableData ?? undefined;
              genieSuggestions = chunk.genieDone.suggestedQuestions;
              if (chunk.genieDone.conversationId) { genieConversationId = chunk.genieDone.conversationId; setGenieConversationId(chatId!, chunk.genieDone.conversationId); }
              if (chunk.genieDone.messageId) genieMessageId = chunk.genieDone.messageId;
            }
          }
          await addMessage(chatId!, { ...placeholder, content: accContent, reasoning: accReasoning, sql: genieSql, tableData: genieTableData, suggestedQuestions: genieSuggestions, genieSpaceId: endpoint, genieConversationId: genieConversationId || undefined, genieMessageId: genieMessageId || undefined });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Genie error";
          toast.error(msg);
          await addMessage(chatId!, { ...placeholder, content: `Error: ${msg}` });
        } finally { setStreamingMessage(null); setIsStreaming(false); }
        return;
      }

      const conversationId = uuidv4();
      const currentChat = chatsRef.current.find((c) => c.id === chatId);
      const history = [...(currentChat?.messages ?? []).map((m) => ({ role: m.role, content: m.content })), { role: "user", content }];
      const assistantMsg: ChatMessage = { id: uuidv4(), role: "assistant", content: "", citations: [], reasoning: "", createdAt: new Date().toISOString() };
      setStreamingMessage(assistantMsg);
      let accContent = "", accReasoning = "";
      const accCitations: Citation[] = [];
      const accSources: AgentSource[] = [];
      try {
        const res = await invokeEndpoint(endpoint, history, conversationId, chatId!);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        for await (const chunk of readSSEStream(reader)) {
          if (chunk.textDelta) { accContent += chunk.textDelta; setStreamingMessage((p) => p ? { ...p, content: accContent } : p); }
          if (chunk.reasoningDelta) { accReasoning += chunk.reasoningDelta; setStreamingMessage((p) => p ? { ...p, reasoning: accReasoning } : p); }
          if (chunk.citation) { accCitations.push(chunk.citation); setStreamingMessage((p) => p ? { ...p, citations: [...accCitations] } : p); }
          if (chunk.finalText !== undefined) { accContent = chunk.finalText; setStreamingMessage((p) => p ? { ...p, content: accContent } : p); }
          if (chunk.agentSource) {
            if (!accSources.some((s) => s.label === chunk.agentSource!.label && s.type === chunk.agentSource!.type)) {
              accSources.push(chunk.agentSource);
            } else if (chunk.agentSource.detail) {
              const idx = accSources.findIndex((s) => s.label === chunk.agentSource!.label && s.type === chunk.agentSource!.type);
              if (idx >= 0) accSources[idx] = { ...accSources[idx], detail: chunk.agentSource.detail };
            }
          }
        }
        await addMessage(chatId!, { ...assistantMsg, content: accContent, reasoning: accReasoning, citations: accCitations, agentSources: accSources.length ? accSources : undefined });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        toast.error(msg);
        await addMessage(chatId!, { ...assistantMsg, content: `Error: ${msg}` });
      } finally { setStreamingMessage(null); setIsStreaming(false); }
    },
    [chatbot.agentType, chatbot.agentId, createChat, addMessage, setIsStreaming, setStreamingMessage, setGenieConversationId, basePath]
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    window.history.pushState(null, "", basePath);
    setStreamingMessage(null);
    setCitationPanelOpen(false);
    setPanelCitations([]);
  }, [setActiveChatId, setStreamingMessage, setCitationPanelOpen, setPanelCitations, basePath]);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    window.history.pushState(null, "", `${basePath}/${id}`);
  }, [setActiveChatId, basePath]);

  const handleDeleteChat = useCallback((id: string) => {
    const remaining = chats.filter((c) => c.id !== id);
    removeChat(id);
    if (activeChatId === id) {
      if (remaining.length > 0) { setActiveChatId(remaining[0].id); window.history.pushState(null, "", `${basePath}/${remaining[0].id}`); }
      else { setActiveChatId(null); window.history.pushState(null, "", basePath); }
    }
  }, [removeChat, activeChatId, chats, setActiveChatId, basePath]);

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
            chatbot={{ name: chatbot.name, description: chatbot.description, agentType: chatbot.agentType }}
          />

          <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <ChatbotWindow
              chatbot={chatbot}
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
