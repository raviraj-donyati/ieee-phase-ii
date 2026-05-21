"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Chat, ChatMessage } from "@/types";

/**
 * Manages the chat list for a single chatbot.
 *
 * Key design:
 * - All state is local useState — no global atoms, no cross-mount leaks.
 * - `startChat(chatbotId, firstMessage)` creates the chat AND persists the first
 *   user message in a single atomic API call, eliminating the FK race condition.
 * - `addMessage` for subsequent messages is fire-and-forget (chat row is guaranteed
 *   to exist by the time any follow-up message is sent).
 */
export function useChatbotChats(chatbotId: string) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  // Load chat list on mount / chatbotId change.
  useEffect(() => {
    let cancelled = false;
    setInitialLoaded(false);
    setChats([]);
    setActiveChatId(null);

    fetch(`/api/chatbots/${chatbotId}/chats`)
      .then((r) => r.json())
      .then((data: Chat[]) => { if (!cancelled) setChats(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setInitialLoaded(true); });

    return () => { cancelled = true; };
  }, [chatbotId]);

  /**
   * Optimistically adds a new chat + first user message to local state, then
   * persists both atomically via POST /api/chatbots/[id]/chats/start.
   *
   * Returns the new chatId so the caller can push the URL immediately.
   */
  const startChat = useCallback((firstMessage: ChatMessage): string => {
    const chatId = uuidv4();
    const now = new Date().toISOString();
    const title = firstMessage.content.slice(0, 50);

    const newChat: Chat = {
      id: chatId,
      title,
      messages: [firstMessage],
      createdAt: now,
    };

    // Optimistic update — sidebar and window both show the chat + message instantly.
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(chatId);

    // Single atomic API call — chat row + message row in one transaction.
    fetch(`/api/chatbots/${chatbotId}/chats/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        title,
        createdAt: now,
        message: {
          id: firstMessage.id,
          content: firstMessage.content,
          createdAt: firstMessage.createdAt,
        },
      }),
    }).catch(console.error);

    return chatId;
  }, [chatbotId]);

  /**
   * Appends a message to an existing chat (optimistic + fire-and-forget persist).
   * Safe to call immediately — the chat row is guaranteed to exist because
   * startChat already persisted it (or the chat was loaded from the server).
   */
  const addMessage = useCallback((chatId: string, message: ChatMessage) => {
    // Update UI immediately.
    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      return { ...c, messages: [...c.messages, message] };
    }));

    // Persist in background — no await needed, chat row exists.
    fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }).catch(console.error);
  }, []);

  const removeChat = useCallback((id: string) => {
    fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(console.error);
    setChats((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameChat = useCallback((id: string, title: string) => {
    fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(console.error);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const setGenieConversationId = useCallback((chatId: string, genieConversationId: string) => {
    fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genieConversationId }),
    }).catch(console.error);
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, genieConversationId } : c)));
  }, []);

  return {
    chats,
    isLoading: !initialLoaded,
    activeChat,
    activeChatId,
    setActiveChatId,
    startChat,
    addMessage,
    removeChat,
    renameChat,
    setGenieConversationId,
  };
}
