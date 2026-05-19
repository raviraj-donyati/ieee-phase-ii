import { KnowledgeAssistant, GenieSpace, SupervisorEndpoint } from "@/types";

export async function fetchKAList(): Promise<KnowledgeAssistant[]> {
  const res = await fetch("/api/ka");
  if (!res.ok) throw new Error("Failed to fetch KA list");
  const data = await res.json();
  return data.knowledge_assistants ?? [];
}

export async function fetchGenieSpaces(): Promise<GenieSpace[]> {
  const res = await fetch("/api/genie");
  if (!res.ok) throw new Error("Failed to fetch Genie spaces");
  const data = await res.json();
  return data.spaces ?? [];
}

export async function fetchSupervisorEndpoints(): Promise<SupervisorEndpoint[]> {
  const res = await fetch("/api/endpoints");
  if (!res.ok) throw new Error("Failed to fetch endpoints");
  const data = await res.json();
  return data.endpoints ?? [];
}

export async function invokeEndpoint(
  endpoint: string,
  messages: { role: string; content: string }[],
  conversationId: string,
  chatId: string,
): Promise<Response> {
  const res = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, messages, conversationId, chatId }),
  });
  if (!res.ok) throw new Error("Failed to invoke endpoint");
  return res;
}


