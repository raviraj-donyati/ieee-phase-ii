"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { v4 as uuidv4 } from "uuid";
import { Chat, ChatMessage } from "@/types";
import {
  chatsAtom, activeChatIdAtom, activeChatAtom,
  userChatsAtom, activeUserChatIdAtom, activeUserChatAtom,
} from "@/lib/atoms";

export function useChats(chatType: "full" | "user" = "full") {
  const isUser = chatType === "user";

  const [chats, setChats]           = useAtom(isUser ? userChatsAtom : chatsAtom);
  const [activeChatId, setActiveChatId] = useAtom(isUser ? activeUserChatIdAtom : activeChatIdAtom);
  const activeChat                  = useAtomValue(isUser ? activeUserChatAtom : activeChatAtom);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const pendingChats = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    fetch(`/api/chats?type=${chatType}`)
      .then((r) => r.json())
      .then((data: Chat[]) => {
        setChats(data);
      })
      .catch(console.error)
      .finally(() => setInitialLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatType]);

  const createChat = useCallback((): Chat => {
    const chat: Chat = {
      id: uuidv4(),
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };

    const promise = fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...chat, chatType }),
    })
      .then(() => { pendingChats.current.delete(chat.id); })
      .catch((err) => { pendingChats.current.delete(chat.id); console.error(err); });

    pendingChats.current.set(chat.id, promise);
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat;
  }, [chatType, setChats, setActiveChatId]);

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
    if (pending) {
      await pending;
    }

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
        title:
          chat.messages.length === 0 && message.role === "user"
            ? message.content.slice(0, 50)
            : chat.title,
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
