# Project Overview

## What We're Building

A **multi-agent AI chat platform** that wraps Databricks AI agents (Knowledge Assistants, Genie, and Supervisor) into a deployable, multi-tenant SaaS application. Organizations can create and manage multiple chatbots backed by different agent types, control who has access to them, and track every conversation with full audit trails.

---

## Core Idea

Rather than exposing raw Databricks endpoints to end users, this platform provides:

- A polished chat UI that works across agent types
- Role-based access control over which users can use which bots
- Persistent chat history, citations, and feedback collection
- An admin dashboard for managing chatbots and users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript |
| UI | shadcn/ui, Radix UI, Tailwind CSS v4, Lucide icons |
| State | Jotai (client state), React Query (server/async state) |
| Database | PostgreSQL via Drizzle ORM |
| Auth | NextAuth v4 — Azure AD + email/password credentials |
| AI Backends | Databricks (Knowledge Assistants, Genie spaces, Supervisor endpoints) |
| Streaming | Server-sent events / NDJSON with custom stream parser |
| Rendering | Shiki (code highlighting), Streamdown (streaming markdown with math, Mermaid) |

---

## Agent Types

| Type | Description |
|---|---|
| **Knowledge Assistant (KA)** | RAG-style Q&A over enterprise documents; responses include citations |
| **Genie** | Databricks Genie space integration; handles SQL queries, returns tables and reasoning steps |
| **Supervisor** | Orchestrates multiple sub-agents; routes queries and aggregates results |

---

## Key Features

### Chat Experience
- Streaming responses rendered incrementally as they arrive
- Citations panel for Knowledge Assistant answers
- Genie thinking steps, SQL traces, and table outputs rendered inline
- Thumbs up/down feedback + free-text comments per message

### Access Control
- Users assigned roles (admin, user, etc.)
- Chatbots can be restricted to specific roles or individual users
- Endpoint-level permissions enforced server-side

### Admin Dashboard
- Create, update, and delete chatbots
- Manage users and role assignments
- View chatbot/user counts and quick-action shortcuts

### Persistence & Audit
- Full chat and message history stored in PostgreSQL
- Citations, reasoning traces, and feedback linked to individual messages
- Server-side NDJSON logging for every Databricks invocation

---

## Database Schema (high level)

```
users ──< chats ──< messages ──< citations
                              └─< feedback
chatbots ──< chats
roles ──< users
chatbots ──< chatbot_access (user/role overrides)
```

---

## Directory Structure

```
app/
  api/           — API routes (auth, chatbots, chats, Databricks proxies, admin)
  admin/         — Admin dashboard pages
  dashboard/     — User-facing bot listing
  c/[id]/        — Individual chatbot chat pages

components/
  chat/          — Core chat UI (layout, sidebar, messages, input)
  admin/         — Admin management UI
  ai-elements/   — Agent-specific output renderers (tables, thinking steps, citations)

lib/
  db/            — Drizzle schema + query helpers
  api.ts         — Client-side API wrappers
  stream-parser.ts — NDJSON/SSE streaming logic
  schemas.ts     — Zod validation schemas

types/           — Shared TypeScript types
proxy.ts         — Databricks endpoint proxy logic
```

---

## Data Flow

1. User sends a message in the chat UI
2. Frontend calls `/api/invoke` (or agent-specific route)
3. Server proxies the request to the Databricks endpoint, streaming the response back
4. Stream parser unpacks NDJSON chunks into typed events (text, citations, SQL, tables, thoughts)
5. UI renders each event type with the appropriate component
6. On completion, the full message + metadata is persisted to PostgreSQL

---

## Databricks Integration

### Authentication

All server-to-Databricks calls use **Personal Access Token (PAT)** authentication. The token and workspace URL are stored in server-only environment variables — never exposed to the browser. User identity is forwarded separately in the request body so Databricks can attribute usage per user without needing per-user credentials.

```env
DATABRICKS_HOST=https://<workspace>.azuredatabricks.net
DATABRICKS_TOKEN=dapi...
```

Every Databricks request includes:
```
Authorization: Bearer ${DATABRICKS_TOKEN}
Content-Type: application/json
```

---

### Agent Types & Databricks APIs

The platform wraps three distinct Databricks agent types, each backed by a different Databricks API family.

#### 1. Knowledge Assistant (KA)

**Databricks API:** `/api/2.1/knowledge-assistants`

Knowledge Assistants perform RAG (Retrieval-Augmented Generation) over enterprise document corpora. They are registered as serving endpoints and invoked via the standard model serving API.

**Discovery:**
```
GET /api/2.1/knowledge-assistants
→ { knowledge_assistants: [{ id, display_name, description, endpoint_name, creator, create_time }] }
```

**Invocation** (via `/api/invoke`):
```
POST /serving-endpoints/{endpoint_name}/invocations
Body: {
  stream: true,
  input: [{ role, content }],
  databricks_options: {
    conversation_id: string,
    return_trace: true,
    long_task: true
  },
  context: { conversation_id, user_id }
}
```

**Response stream events:**
- `response.output_text.delta` — incremental answer text
- `response.output_text.annotation.added` with `type: "url_citation"` — document citations (title, URL, snippet, page range)
- `response.output_item.done` — end of a content item
- `response.completed` — end of stream

**Pre-flight health check:** Before invoking, the server calls `GET /api/2.0/serving-endpoints/{endpoint}` and verifies `state.ready === "READY"`. Returns 503 if the endpoint is not ready.

---

#### 2. Genie

**Databricks API:** `/api/2.0/genie/spaces`

Genie translates natural language into SQL, executes it against a Delta warehouse, and returns results with reasoning traces. Unlike KA, Genie uses a **polling model** — the client starts a conversation, then polls every 2 seconds until the response is ready (up to 30 polls / ~60 seconds).

**Discovery:**
```
GET /api/2.0/genie/spaces
→ { spaces: [{ space_id, title, warehouse_id }] }
```

**Conversation lifecycle:**

```
1. Start (first turn)
   POST /api/2.0/genie/spaces/{spaceId}/start-conversation
   Body: { content: query }
   → { conversation: { id }, message: { message_id } }

2. Continue (subsequent turns)
   POST /api/2.0/genie/spaces/{spaceId}/conversations/{convId}/messages
   Body: { content: query }
   → { message_id }

3. Poll until status is COMPLETED or FAILED
   GET /api/2.0/genie/spaces/{spaceId}/conversations/{convId}/messages/{msgId}
   → { status, attachments: [...] }
   (polled every 2 seconds, up to 30 times)

4. If status is QUERY_RESULT_EXPIRED — re-execute first
   POST .../attachments/{attachmentId}/execute-query

5. Fetch query result (paginated if needed)
   GET .../attachments/{attachmentId}/query-result[?chunk_index=N]
   → {
       statement_response: {
         manifest: { schema: { columns: [{ name }] } },
         result: { data_array: string[][], next_chunk_index: number | null }
       }
     }
   Fetch subsequent chunks until next_chunk_index is null.
```

**Attachment types inside the poll response:**

| Attachment field | Content |
|---|---|
| `text.content` | Final answer text |
| `query.query` | Generated SQL |
| `query.thoughts` | Array of reasoning thought objects |
| `suggested_questions.questions` | Follow-up question suggestions |
| `attachment_id` | Used to fetch query results |

**Server-sent events emitted to the client:**

| Event type | Payload | Description |
|---|---|---|
| `genie.thinking` | `{ poll: number }` | Heartbeat during early polls (before first thought arrives) |
| `genie.thought` | `{ thoughtType, label, bullets }` | One reasoning step; emitted as thoughts arrive during polling |
| `response.output_text.delta` | `{ delta: string }` | Answer text, word-by-word with 18ms delay (simulated streaming) |
| `genie.done` | `{ sql, tableData, suggestedQuestions, conversationId, messageId }` | Final metadata |
| `error` | `{ message: string }` | Error from Databricks or timeout |

**Thought types and their labels:**

| `thoughtType` | Display label |
|---|---|
| `THOUGHT_TYPE_DATA_SOURCING` | Identifying data sources |
| `THOUGHT_TYPE_DESCRIPTION` | Understanding your question |
| `THOUGHT_TYPE_DEFINITION` | Understanding definition |
| `THOUGHT_TYPE_INTERPRETATION` | Interpreting definition |
| `THOUGHT_TYPE_STEPS` | Planning the query |

Thoughts are deduplicated across polls (tracked by `thoughtType:content` key) and sorted into the canonical order above before being displayed.

**Feedback & comments forwarded to Databricks:**
```
POST .../messages/{msgId}/feedback   → { rating: "POSITIVE"|"NEGATIVE", comment? }
POST .../messages/{msgId}/comments   → { content: string }
```
Feedback is also saved locally to PostgreSQL regardless of whether the Databricks call succeeds.

---

#### 3. Supervisor

**Databricks API:** `/api/2.0/serving-endpoints`

Supervisor endpoints are model-serving endpoints that orchestrate multiple sub-agents (KA, Genie, tools). They are identified by having a `display_name` tag on the endpoint.

**Discovery:**
```
GET /api/2.0/serving-endpoints
→ filtered to endpoints with a display_name tag
→ { endpoints: [{ name, display_name, state, creator, description, task, ... }] }
```

**Invocation** (same route as KA, `/api/invoke`):
```
POST /serving-endpoints/{endpoint}/invocations
Body: {
  stream: true,
  input: [{ role, content }],
  databricks_options: {
    conversation_id: string,
    return_trace: true,
    long_task: true
  },
  context: { conversation_id, user_id }
}
```

**Supervisor-specific stream events:**

Supervisor responses include a `step` field on events. The stream parser uses the step number to classify text:
- **Lower steps** → reasoning / intermediate output
- **Highest step** → final answer text

Tool calls arrive as `response.output_item.done` events with `type: "function_call"`. Their names are title-cased and surfaced in the reasoning panel. Tool names are classified into source types:
- Names containing `genie`, `organizational`, or `volunteer` → `sql` source type
- Names containing `knowledge` or `ka` → `kb` source type
- Everything else → `tool` source type

At `response.completed`, the server extracts SQL queries from the MLflow trace:
```
databricks_output.trace.data.spans[].attributes.sql_query
databricks_output.trace.data.spans[].attributes.description
```

---

### Stream Parser (`lib/stream-parser.ts`)

The `readSSEStream` async generator is the central piece that translates raw Databricks SSE bytes into typed UI events. It handles both KA/Supervisor streams and Genie streams from the same function.

**Output event types:**

| Yielded event | Triggered by | Data |
|---|---|---|
| `textDelta` | `response.output_text.delta` | `{ text }` |
| `citation` | `response.output_text.annotation.added` (url_citation) | `{ title, url, snippet, startPageNumber, endPageNumber, annotationIndex }` |
| `reasoningDelta` | step-change or function_call item | `{ text }` |
| `agentSource` | function_call item or genie.done | `{ type, label, detail, description }` |
| `genieThought` | `genie.thought` | `{ thoughtType, label, bullets }` |
| `genieThinking` | `genie.thinking` | `true` |
| `genieDone` | `genie.done` | `{ sql, tableData, suggestedQuestions, conversationId, messageId }` |
| `finalText` | `response.output_item.done` (no step) or step-change | `{ text }` |

**Citation URL parsing:** Citations embed their snippet and page range in the URL fragment:
```
#page=3:~:text=encoded%20snippet
```
The parser extracts and HTML-decodes these for display.

**Catalog prefix stripping:** In Genie thought bullets, fully-qualified table names like `catalog.schema.table_name` are simplified to just `table name` for readability.

---

### NDJSON Logging & Observability

Every invocation through `/api/invoke` is logged server-side to:
```
logs/{chatId}/{question-slug}.ndjson
```

Each line is a JSON object with a `type` field:

| Log entry type | When emitted |
|---|---|
| `invoke.start` | Request received |
| `invoke.health` | Endpoint health check result |
| `invoke.stream_start` | First byte of streaming response |
| `sse_raw` | Every raw SSE chunk (includes type, step, delta preview, item metadata) |
| `invoke.stream_end` | Stream closed |
| `invoke.error` | Any error during invocation |

Browser-side parser events are sent to `POST /api/debug-log` and merged into the same log. The response headers `X-Log-Chat-Id` and `X-Log-Question-Slug` are used by the client to route its logs to the correct file.

The debug log API (`/api/debug-log`) supports:
- `GET` — list all logged chats or questions within a chat
- `GET ?chatId=X&question=Y` — retrieve all NDJSON entries for a specific exchange
- `POST` — append browser-side log entries
