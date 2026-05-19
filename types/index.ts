import type { z } from "zod";
import type {
  ChatModeSchema,
  CitationSchema,
  ChatMessageSchema,
  ChatSchema,
  KnowledgeAssistantSchema,
  GenieSpaceSchema,
  SupervisorEndpointSchema,
  StreamEventSchema,
  ChatbotSchema,
  ChatbotAccessSchema,
  AgentSourceSchema,
  TimingLogSchema,
} from "@/lib/schemas";

export type ChatMode = z.infer<typeof ChatModeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type TimingLog = z.infer<typeof TimingLogSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Chat = z.infer<typeof ChatSchema>;
export type KnowledgeAssistant = z.infer<typeof KnowledgeAssistantSchema>;
export type GenieSpace = z.infer<typeof GenieSpaceSchema>;
export type SupervisorEndpoint = z.infer<typeof SupervisorEndpointSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type Chatbot = z.infer<typeof ChatbotSchema>;
export type ChatbotAccess = z.infer<typeof ChatbotAccessSchema>;
export type AgentSource = z.infer<typeof AgentSourceSchema>;

export interface GenieQueryResult {
  columns: string[];
  rows: string[][];
}

export interface GenieThought {
  thoughtType: string;
  label: string;
  bullets: string[];
}
