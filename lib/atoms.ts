import { atom } from "jotai";
import { z } from "zod";

import {
  Chat,
  ChatMessage,
  Citation,
  ChatMode,
} from "@/types";

import {
  KnowledgeAssistantSchema,
  GenieSpaceSchema,
  SupervisorEndpointSchema,
} from "@/lib/schemas";


// =========================
// 🧠 ZOD → TYPES (BEST PRACTICE)
// =========================
export type KAItem = z.infer<typeof KnowledgeAssistantSchema>;
export type GenieItem = z.infer<typeof GenieSpaceSchema>;
export type SupervisorItem = z.infer<typeof SupervisorEndpointSchema>;


// =========================
// 💬 CHAT STATE (DB-backed)
// =========================
export const chatsAtom = atom<Chat[]>([]);
export const userChatsAtom = atom<Chat[]>([]);

export const activeChatIdAtom = atom<string | null>(null);
export const activeUserChatIdAtom = atom<string | null>(null);

export const activeChatAtom = atom((get) => {
  const id = get(activeChatIdAtom);
  if (!id) return null;
  return get(chatsAtom).find((c) => c.id === id) ?? null;
});

export const activeUserChatAtom = atom((get) => {
  const id = get(activeUserChatIdAtom);
  if (!id) return null;
  return get(userChatsAtom).find((c) => c.id === id) ?? null;
});


// =========================
// ⚡ STREAMING STATE
// =========================
export const isStreamingAtom = atom(false);

export const streamingMessageAtom = atom<ChatMessage | null>(null);

export const citationPanelOpenAtom = atom(false);

export const panelCitationsAtom = atom<Citation[]>([]);


// =========================
// 🤖 MODE + SELECTION
// =========================
export const modeAtom = atom<ChatMode>("ka");

export const selectedItemAtom = atom<string | null>(null);


// =========================
// 📡 API DATA (TYPED ❌ no any)
// =========================
export const kaListAtom = atom<KAItem[]>([]);
export const genieListAtom = atom<GenieItem[]>([]);
export const supervisorListAtom = atom<SupervisorItem[]>([]);


// =========================
// 🔥 DERIVED DEFAULT SELECTION
// =========================
export const defaultSelectedAtom = atom((get) => {
  const mode = get(modeAtom);

  if (mode === "ka") {
    const list = get(kaListAtom);
    return list[0]?.endpoint_name ?? null;
  }

  if (mode === "genie") {
    const list = get(genieListAtom);
    return list[0]?.space_id ?? null;
  }

  if (mode === "supervisor") {
    const list = get(supervisorListAtom);
    return list[0]?.name ?? null;
  }

  return null;
});


// =========================
// ✅ FINAL EFFECTIVE VALUE
// =========================
export const effectiveSelectedAtom = atom((get) => {
  return get(selectedItemAtom) ?? get(defaultSelectedAtom);
});