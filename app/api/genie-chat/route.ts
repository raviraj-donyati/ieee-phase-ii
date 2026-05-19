import { NextRequest } from "next/server";
import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function startConversation(spaceId: string, content: string) {
  const res = await databricksFetch(
    `${HOST}/api/2.0/genie/spaces/${spaceId}/start-conversation`,
    { method: "POST", headers, body: JSON.stringify({ content }), timeoutMs: 15_000 }
  );
  if (!res.ok) throw new Error(`Start conversation failed: ${res.status}`);
  const data = await res.json();
  // Response shape: { conversation: { id }, message: { message_id } }
  return {
    conversation_id: data.conversation.id as string,
    message_id: data.message.message_id as string,
  };
}

async function createMessage(spaceId: string, conversationId: string, content: string) {
  const res = await databricksFetch(
    `${HOST}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages`,
    { method: "POST", headers, body: JSON.stringify({ content }), timeoutMs: 15_000 }
  );
  if (!res.ok) throw new Error(`Create message failed: ${res.status}`);
  return res.json();
}

async function pollMessage(
  spaceId: string,
  conversationId: string,
  messageId: string
) {
  const res = await databricksFetch(
    `${HOST}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}`,
    { headers, timeoutMs: 10_000 }
  );
  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json();
}

const ATTACHMENT_BASE = (spaceId: string, conversationId: string, messageId: string, attachmentId: string) =>
  `${HOST}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}`;

async function executeQuery(spaceId: string, conversationId: string, messageId: string, attachmentId: string) {
  const res = await databricksFetch(`${ATTACHMENT_BASE(spaceId, conversationId, messageId, attachmentId)}/execute-query`, { method: "POST", headers, timeoutMs: 15_000 });
  if (!res.ok) throw new Error(`Execute query failed: ${res.status}`);
  return res.json();
}

async function getQueryResult(spaceId: string, conversationId: string, messageId: string, attachmentId: string) {
  const res = await databricksFetch(`${ATTACHMENT_BASE(spaceId, conversationId, messageId, attachmentId)}/query-result`, { headers, timeoutMs: 10_000 });
  if (!res.ok) return null;
  return res.json();
}

async function getAllQueryRows(
  spaceId: string,
  conversationId: string,
  messageId: string,
  attachmentId: string,
  messageStatus: string
): Promise<{ columns: string[]; rows: string[][] } | null> {
  // If result expired, re-execute first
  if (messageStatus === "QUERY_RESULT_EXPIRED") {
    await executeQuery(spaceId, conversationId, messageId, attachmentId);
  }

  const first = await getQueryResult(spaceId, conversationId, messageId, attachmentId);
  if (!first?.statement_response?.manifest?.schema?.columns) return null;

  const columns = first.statement_response.manifest.schema.columns.map((c: { name: string }) => c.name);
  const rows: string[][] = [...(first.statement_response.result?.data_array ?? [])];

  let chunkIndex: number | undefined = first.statement_response.result?.next_chunk_index;
  while (chunkIndex !== undefined && chunkIndex !== null) {
    const chunkRes = await databricksFetch(
      `${ATTACHMENT_BASE(spaceId, conversationId, messageId, attachmentId)}/query-result?chunk_index=${chunkIndex}`,
      { headers, timeoutMs: 10_000 }
    );
    if (!chunkRes.ok) break;
    const chunk = await chunkRes.json();
    rows.push(...(chunk.statement_response?.result?.data_array ?? []));
    chunkIndex = chunk.statement_response?.result?.next_chunk_index;
  }

  return { columns, rows };
}

const THOUGHT_LABELS: Record<string, string> = {
  THOUGHT_TYPE_DESCRIPTION: "Understanding your question",
  THOUGHT_TYPE_DATA_SOURCING: "Identifying data sources",
  THOUGHT_TYPE_STEPS: "Planning the query",
  THOUGHT_TYPE_DEFINITION: "Understanding definition",
  THOUGHT_TYPE_INTERPRETATION: "Interpreting definition",
};

const THOUGHT_ORDER = [
  "THOUGHT_TYPE_DATA_SOURCING",
  "THOUGHT_TYPE_DESCRIPTION",
  "THOUGHT_TYPE_DEFINITION",
  "THOUGHT_TYPE_INTERPRETATION",
  "THOUGHT_TYPE_STEPS",
];

function parseThoughtBullets(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    // strip catalog prefixes like dbw_donyati_sandbox.ieee_poc.volunteer_data → volunteer data
    .map((l) => l.replace(/^[\w]+\.[\w]+\./, "").replace(/_/g, " "));
}

export async function POST(req: NextRequest) {
  const { spaceId, content, conversationId: existingConversationId } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (data: unknown) => {
        controller.enqueue(enc.encode(sse(data)));
      };

      try {
        let conversationId: string;
        let messageId: string;
        if (existingConversationId) {
          const msg = await createMessage(spaceId, existingConversationId, content);
          conversationId = existingConversationId;
          messageId = msg.message_id;
        } else {
          const started = await startConversation(spaceId, content);
          conversationId = started.conversation_id;
          messageId = started.message_id;
        }

        const emittedThoughts = new Set<string>();
        let message: Record<string, unknown> | null = null;
        let pollCount = 0;

        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          message = await pollMessage(spaceId, conversationId, messageId);
          pollCount++;

          const attachments = (message as { attachments?: unknown[] }).attachments ?? [];
          const queryAtt = (attachments as Array<{ query?: { thoughts?: Array<{ thought_type: string; content: string }> } }>)
            .find((a) => a.query?.thoughts);

          // Collect all thoughts, sort by canonical order, emit new ones as structured events
          const allThoughts = queryAtt?.query?.thoughts ?? [];
          const sorted = [...allThoughts].sort(
            (a, b) => (THOUGHT_ORDER.indexOf(a.thought_type) ?? 99) - (THOUGHT_ORDER.indexOf(b.thought_type) ?? 99)
          );
          for (const t of sorted) {
            const key = `${t.thought_type}:${t.content}`;
            if (!emittedThoughts.has(key)) {
              emittedThoughts.add(key);
              emit({
                type: "genie.thought",
                thoughtType: t.thought_type,
                label: THOUGHT_LABELS[t.thought_type] ?? t.thought_type.replace(/THOUGHT_TYPE_/i, "").toLowerCase().replace(/_/g, " "),
                bullets: parseThoughtBullets(t.content),
              });
            }
          }

          // Emit a heartbeat so the UI knows we're still polling
          if (allThoughts.length === 0 && pollCount <= 3) {
            emit({ type: "genie.thinking", poll: pollCount });
          }

          const status = (message as { status?: string }).status;
          if (status === "COMPLETED" || status === "FAILED" || status === "QUERY_RESULT_EXPIRED") break;
        }

        if (!message) { emit({ type: "error", message: "Timeout" }); controller.close(); return; }

        const attachments = (message as { attachments?: unknown[] }).attachments ?? [];
        const textContent = (attachments as Array<{ text?: { content?: string } }>).find((a) => a.text?.content)?.text?.content ?? "";
        const queryAttachment = (attachments as Array<{ query?: { query?: string }; attachment_id?: string }>).find((a) => a.query?.query);
        const sql = queryAttachment?.query?.query ?? "";
        const attachmentId = queryAttachment?.attachment_id ?? "";
        const suggestedQuestions = (attachments as Array<{ suggested_questions?: { questions?: string[] } }>)
          .find((a) => a.suggested_questions?.questions)?.suggested_questions?.questions ?? [];

        // Fetch table data
        let tableData: { columns: string[]; rows: string[][] } | null = null;
        const finalStatus = (message as { status?: string }).status ?? "";
        if (attachmentId) {
          tableData = await getAllQueryRows(spaceId, conversationId, messageId, attachmentId, finalStatus);
        }

        // Emit genie metadata FIRST so table/sql are set before content arrives
        emit({ type: "genie.done", sql, tableData, suggestedQuestions, conversationId, messageId });
        // Stream the text answer word-by-word for a natural typing feel
        if (textContent) {
          const words = textContent.match(/\S+\s*/g) ?? [textContent];
          for (const word of words) {
            emit({ type: "response.output_text.delta", delta: word });
            await new Promise((r) => setTimeout(r, 18));
          }
        }
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Genie error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
