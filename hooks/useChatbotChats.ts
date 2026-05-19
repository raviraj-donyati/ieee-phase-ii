"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { atom, useAtom, useAtomValue } from "jotai";
import { v4 as uuidv4 } from "uuid";
import { Chat, ChatMessage } from "@/types";

// Per-chatbot atoms stored in a map — created lazily
const chatbotChatsAtomMap = new Map<string, ReturnType<typeof atom<Chat[]>>>();
const chatbotActiveChatIdAtomMap = new Map<string, ReturnType<typeof atom<string | null>>>();

function getChatsAtom(chatbotId: string) {
  if (!chatbotChatsAtomMap.has(chatbotId)) {
    chatbotChatsAtomMap.set(chatbotId, atom<Chat[]>([]));
  }
  return chatbotChatsAtomMap.get(chatbotId)!;
}

function getActiveChatIdAtom(chatbotId: string) {
  if (!chatbotActiveChatIdAtomMap.has(chatbotId)) {
    chatbotActiveChatIdAtomMap.set(chatbotId, atom<string | null>(null));
  }
  return chatbotActiveChatIdAtomMap.get(chatbotId)!;
}

export function useChatbotChats(chatbotId: string) {
  const chatsAtom = getChatsAtom(chatbotId);
  const activeChatIdAtom = getActiveChatIdAtom(chatbotId);

  const [chats, setChats] = useAtom(chatsAtom);
  const [activeChatId, setActiveChatId] = useAtom(activeChatIdAtom);
  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const [initialLoaded, setInitialLoaded] = useState(false);
  const pendingChats = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    setInitialLoaded(false);
    fetch(`/api/chatbots/${chatbotId}/chats`)
      .then((r) => r.json())
      .then((data: Chat[]) => setChats(data))
      .catch(console.error)
      .finally(() => setInitialLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId]);

  const createChat = useCallback((): Chat => {
    const chat: Chat = {
      id: uuidv4(),
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };

    const promise = fetch(`/api/chatbots/${chatbotId}/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chat),
    })
      .then(() => { pendingChats.current.delete(chat.id); })
      .catch((err) => { pendingChats.current.delete(chat.id); console.error(err); });

    pendingChats.current.set(chat.id, promise);
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat;
  }, [chatbotId, setChats, setActiveChatId]);

  const removeChat = useCallback((id: string) => {
    fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(console.error);
    setChats((prev) => prev.filter((c) => c.id !== id));
    setActiveChatId((prev) => {
      if (prev !== id) return prev;
      const remaining = chats.filter((c) => c.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, [chats, setChats, setActiveChatId]);

  const addMessage = useCallback(async (chatId: string, message: ChatMessage) => {
    const pending = pendingChats.current.get(chatId);
    if (pending) await pending;

    fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }).catch(console.error);

    setChats((prev) => {
      const chat = prev.find((c) => c.id === chatId);
      if (!chat) return prev;
      const updated: Chat = {
        ...chat,
        title: chat.messages.length === 0 && message.role === "user"
          ? message.content.slice(0, 50) : chat.title,
        messages: [...chat.messages, message],
      };
      if (updated.title !== chat.title) {
        fetch(`/api/chats/${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: updated.title }),
        }).catch(console.error);
      }
      return prev.map((c) => (c.id === chatId ? updated : c));
    });
  }, [setChats]);

  const renameChat = useCallback((id: string, title: string) => {
    fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(console.error);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, [setChats]);

  const setGenieConversationId = useCallback((chatId: string, genieConversationId: string) => {
    fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genieConversationId }),
    }).catch(console.error);
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, genieConversationId } : c)));
  }, [setChats]);

  return {
    chats,
    isLoading: !initialLoaded,
    activeChat,
    activeChatId,
    setActiveChatId,
    createChat,
    removeChat,
    renameChat,
    addMessage,
    setGenieConversationId,
  };
}
