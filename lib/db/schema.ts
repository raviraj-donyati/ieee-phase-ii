import {
  pgTable, uuid, text, timestamp, integer, jsonb, boolean, index, unique, primaryKey,
} from "drizzle-orm/pg-core";

// =============================================================================
// USERS
// =============================================================================
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  name:         text("name"),
  image:        text("image"),
  passwordHash: text("password_hash"),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("users_email_idx").on(t.email),
]);

// =============================================================================
// ROLES  (admin | member | viewer — extensible)
// =============================================================================
export const roles = pgTable("roles", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        text("name").notNull().unique(),   // e.g. "admin", "member", "viewer"
  description: text("description"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// USER ↔ ROLE  (many-to-many)
// =============================================================================
export const userRoles = pgTable("user_roles", {
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId:    uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId] }),
  index("user_roles_user_id_idx").on(t.userId),
  index("user_roles_role_id_idx").on(t.roleId),
]);

// =============================================================================
// ENDPOINT PERMISSIONS
// Controls which roles can access a given endpoint/tool
// tool_type: "ka" | "genie" | "supervisor"
// endpoint_id: the endpoint_name / space_id / supervisor name
// =============================================================================
export const endpointPermissions = pgTable("endpoint_permissions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  toolType:   text("tool_type").notNull(),     // "ka" | "genie" | "supervisor"
  endpointId: text("endpoint_id").notNull(),   // endpoint_name / space_id / name
  roleId:     uuid("role_id").references(() => roles.id, { onDelete: "cascade" }),
  isPublic:   boolean("is_public").notNull().default(false), // true = all authenticated users
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy:  uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  index("ep_tool_endpoint_idx").on(t.toolType, t.endpointId),
  index("ep_role_idx").on(t.roleId),
]);

// =============================================================================
// USER ENDPOINT PERMISSIONS  (direct user-level override)
// Allows granting/revoking access to a specific endpoint for a specific user
// regardless of their role
// =============================================================================
export const userEndpointPermissions = pgTable("user_endpoint_permissions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toolType:   text("tool_type").notNull(),
  endpointId: text("endpoint_id").notNull(),
  granted:    boolean("granted").notNull().default(true), // false = explicitly denied
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy:  uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  unique("uep_user_tool_endpoint_uniq").on(t.userId, t.toolType, t.endpointId),
  index("uep_user_id_idx").on(t.userId),
  index("uep_tool_endpoint_idx").on(t.toolType, t.endpointId),
]);

// =============================================================================
// USER SETTINGS
// =============================================================================
export const userSettings = pgTable("user_settings", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  defaultMode:     text("default_mode").notNull().default("ka"),   // "ka" | "genie" | "supervisor"
  defaultEndpoint: text("default_endpoint"),                        // endpoint_name / space_id / name
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("user_settings_user_id_idx").on(t.userId),
]);

// =============================================================================
// CHATBOTS  (platform-level chatbot definitions)
// agent_type: "ka" | "genie" | "supervisor"
// agent_id:   endpoint_name / space_id / supervisor name
// =============================================================================
export const chatbots = pgTable("chatbots", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        text("name").notNull(),
  description: text("description"),
  slug:        text("slug").notNull().unique(),
  agentType:   text("agent_type").notNull(),
  agentId:     text("agent_id").notNull(),
  logoUrl:     text("logo_url"),
  isActive:    boolean("is_active").notNull().default(true),
  createdBy:   uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("chatbots_slug_idx").on(t.slug),
  index("chatbots_is_active_idx").on(t.isActive),
]);

// =============================================================================
// CHATBOT ACCESS  (who can access which chatbot — user or role level)
// Exactly one of user_id or role_id must be set.
// =============================================================================
export const chatbotAccess = pgTable("chatbot_access", {
  id:        uuid("id").primaryKey().defaultRandom(),
  chatbotId: uuid("chatbot_id").notNull().references(() => chatbots.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  roleId:    uuid("role_id").references(() => roles.id, { onDelete: "cascade" }),
  grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("chatbot_access_chatbot_id_idx").on(t.chatbotId),
  index("chatbot_access_user_id_idx").on(t.userId),
  index("chatbot_access_role_id_idx").on(t.roleId),
]);

// =============================================================================
// CHATS  (now linked to a user)
// =============================================================================
export const chats = pgTable("chats", {
  id:                   uuid("id").primaryKey(),
  userId:               uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  chatbotId:            uuid("chatbot_id").references(() => chatbots.id, { onDelete: "cascade" }),
  title:                text("title").notNull(),
  chatType:             text("chat_type").notNull().default("full"), // "full" | "user" | "chatbot"
  mode:                 text("mode"),
  selectedItem:         text("selected_item"),
  genieConversationId:  text("genie_conversation_id"),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("chats_user_id_idx").on(t.userId),
  index("chats_chatbot_id_idx").on(t.chatbotId),
  index("chats_chat_type_idx").on(t.chatType),
  index("chats_created_at_idx").on(t.createdAt),
]);

// =============================================================================
// MESSAGES
// =============================================================================
export const messages = pgTable("messages", {
  id:                  uuid("id").primaryKey(),
  chatId:              uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role:                text("role").notNull(),
  content:             text("content").notNull(),
  reasoning:           text("reasoning"),
  genieThoughts:       jsonb("genie_thoughts"),
  sql:                 text("sql"),
  suggestedQuestions:  text("suggested_questions").array(),
  genieSpaceId:        text("genie_space_id"),
  genieConversationId: text("genie_conversation_id"),
  genieMessageId:      text("genie_message_id"),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("messages_chat_id_idx").on(t.chatId),
  index("messages_created_at_idx").on(t.createdAt),
]);

// =============================================================================
// CITATIONS
// =============================================================================
export const citations = pgTable("citations", {
  id:              uuid("id").primaryKey().defaultRandom(),
  messageId:       uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  type:            text("type").notNull().default("url_citation"),
  title:           text("title").notNull(),
  url:             text("url").notNull(),
  annotationIndex: integer("annotation_index").notNull(),
  snippet:         text("snippet"),
  startPageNumber: integer("start_page_number"),
  endPageNumber:   integer("end_page_number"),
}, (t) => [
  index("citations_message_id_idx").on(t.messageId),
]);

// =============================================================================
// MESSAGE TABLE DATA
// =============================================================================
export const messageTableData = pgTable("message_table_data", {
  id:        uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  columns:   text("columns").array().notNull(),
  rows:      jsonb("rows").notNull(),
}, (t) => [
  index("table_data_message_id_idx").on(t.messageId),
]);

// =============================================================================
// MESSAGE FEEDBACK
// =============================================================================
export const messageFeedback = pgTable("message_feedback", {
  id:        uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }).unique(),
  rating:    text("rating").notNull(), // "up" | "down"
  comment:   text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("feedback_message_id_idx").on(t.messageId),
]);
