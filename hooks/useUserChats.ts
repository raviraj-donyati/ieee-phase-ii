"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Chat, ChatMessage } from "@/types";

/**
 * Manages the chat list for the /chat page.
 *
 * All state is local useState — no global atoms, no cross-mount leaks.
 * startChat() creates the chat + first user message atomically in one API call.
 * addMessage() for subsequent messages is fire-and-forget (chat row guaranteed to exist).
 */
export function useUserChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    let cancelled = false;
    setInitialLoaded(false);
    setChats([]);
    setActiveChatId(null);

    fetch("/api/chats?type=user")
      .then((r) => r.json())
      .then((data: Chat[]) => { if (!cancelled) setChats(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setInitialLoaded(true); });

    return () => { cancelled = true; };
  }, []);

  /**
   * Optimistically creates a new chat with the first user message already in it,
   * then persists both atomically via POST /api/chats/start.
   * Returns the new chatId immediately — no await needed.
   */
  const startChat = useCallback((
    firstMessage: ChatMessage,
    chatbotId: string,
    mode: string,
    selectedItem: string,
  ): string => {
    const chatId = uuidv4();
    const now = new Date().toISOString();
    const title = firstMessage.content.slice(0, 50);

    const newChat: Chat = {
      id: chatId,
      title,
      messages: [firstMessage],
      chatbotId,
      createdAt: now,
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(chatId);

    fetch("/api/chats/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        title,
        createdAt: now,
        chatbotId,
        mode,
        selectedItem,
        message: {
          id: firstMessage.id,
          content: firstMessage.content,
          createdAt: firstMessage.createdAt,
        },
      }),
    }).catch(console.error);

    return chatId;
  }, []);

  /**
   * Appends a message to an existing chat.
   * Synchronous UI update + fire-and-forget persist.
   */
  const addMessage = useCallback((chatId: string, message: ChatMessage) => {
    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      return { ...c, messages: [...c.messages, message] };
    }));

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
