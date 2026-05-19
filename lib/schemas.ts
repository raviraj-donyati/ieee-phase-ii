import { z } from "zod";

export const ChatModeSchema = z.enum(["ka", "genie", "supervisor"]);

export const ChatbotSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().nullable().optional(),
  slug:        z.string(),
  agentType:   z.enum(["ka", "genie", "supervisor"]),
  agentId:     z.string(),
  logoUrl:     z.string().nullable().optional(),
  isActive:    z.boolean(),
  createdBy:   z.string().nullable().optional(),
  createdAt:   z.string(),
  updatedAt:   z.string(),
});

export const ChatbotAccessSchema = z.object({
  id:        z.string(),
  chatbotId: z.string(),
  userId:    z.string().nullable().optional(),
  roleId:    z.string().nullable().optional(),
  grantedBy: z.string().nullable().optional(),
  grantedAt: z.string(),
});

export const CitationSchema = z.object({
  type: z.literal("url_citation"),
  title: z.string(),
  url: z.string(),
  annotationIndex: z.number(),
  snippet: z.string().optional(),
  startPageNumber: z.number().optional(),
  endPageNumber: z.number().optional(),
});

export const AgentSourceSchema = z.object({
  type: z.enum(["sql", "kb", "tool"]),
  label: z.string(),
  detail: z.string().optional(),
  description: z.string().optional(),
});

export const GenieThoughtSchema = z.object({
  thoughtType: z.string(),
  label: z.string(),
  bullets: z.array(z.string()),
});

export const TimingLogSchema = z.object({
  label: z.string(),
  ts: z.number(), // ms since epoch (Date.now())
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  citations: z.array(CitationSchema),
  reasoning: z.string().optional(),
  genieThoughts: z.array(GenieThoughtSchema).optional(),
  timingLogs: z.array(TimingLogSchema).optional(),
  createdAt: z.string(),
  sql: z.string().optional(),
  tableData: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
  suggestedQuestions: z.array(z.string()).optional(),
  // Genie-specific IDs for feedback API
  genieSpaceId: z.string().optional(),
  genieConversationId: z.string().optional(),
  genieMessageId: z.string().optional(),
  // Persisted feedback
  genieFeedback: z.object({ rating: z.enum(["up", "down"]), comment: z.string().nullable() }).optional(),
  // Agent sources (tool calls, SQL, KB docs)
  agentSources: z.array(AgentSourceSchema).optional(),
});

export const ChatSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.string(),
  chatbotId: z.string().optional(),
  mode: ChatModeSchema.optional(),
  selectedItem: z.string().optional(),
  genieConversationId: z.string().optional(),
});

export const KnowledgeAssistantSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  description: z.string(),
  endpoint_name: z.string(),
  creator: z.string(),
  create_time: z.string(),
});

export const GenieSpaceSchema = z.object({
  space_id: z.string(),
  title: z.string(),
  warehouse_id: z.string().optional(),
});

export const SupervisorEndpointSchema = z.object({
  name: z.string(),
  display_name: z.string(),
  state: z.object({ ready: z.string().optional(), config_update: z.string().optional() }).optional(),
  creator: z.string().optional(),
  description: z.string().optional(),
  task: z.string().optional(),
  creation_timestamp: z.number().optional(),
  last_updated_timestamp: z.number().optional(),
});

export const StreamEventSchema = z.object({
  type: z.string(),
  delta: z.string().optional(),
  annotation: z
    .object({
      type: z.string(),
      title: z.string(),
      url: z.string(),
      snippet: z.string().optional(),
      start_page_number: z.number().optional(),
      end_page_number: z.number().optional(),
    })
    .optional(),
  annotation_index: z.number().optional(),
  item_id: z.string().optional(),
  content_index: z.number().optional(),
  sequence_number: z.number().optional(),
  item: z
    .object({
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
      role: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});
