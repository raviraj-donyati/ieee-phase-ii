import { Citation, StreamEvent, AgentSource, GenieThought } from "@/types";

export interface ParsedChunk {
  textDelta?: string;
  reasoningDelta?: string;
  citation?: Citation;
  finalText?: string;
  agentSource?: AgentSource;
  genieThought?: GenieThought;
  genieThinking?: boolean;
  timingLog?: { label: string; ts: number };
  genieDone?: { sql: string; tableData: { columns: string[]; rows: string[][] } | null; suggestedQuestions: string[]; conversationId: string; messageId: string };
}

export function parseSSELine(line: string): StreamEvent | null {
  if (!line.startsWith("data: ")) return null;
  try { return JSON.parse(line.slice(6)); } catch { return null; }
}

export function processStreamEvent(event: StreamEvent): ParsedChunk {
  const chunk: ParsedChunk = {};
  if (event.type === "response.reasoning_summary_text.delta" && event.delta) {
    chunk.reasoningDelta = event.delta;
  } else if (event.type === "response.output_text.annotation.added" && event.annotation?.type === "url_citation") {
    const url = event.annotation.url;
    let pageNumber: number | undefined;
    let snippet: string | undefined;
    try {
      const hash = url.split("#")[1] ?? "";
      const m = hash.match(/page=(\d+)/);
      if (m) pageNumber = parseInt(m[1], 10);
      const t = hash.match(/:~:text=(.+)$/);
      if (t) snippet = decodeURIComponent(t[1]).replace(/\+/g, " ").replace(/<[^>]+>/g, "").replace(/\n+/g, " ").trim();
    } catch { /* ignore */ }
    chunk.citation = {
      type: "url_citation", title: event.annotation.title, url,
      annotationIndex: event.content_index ?? event.annotation_index ?? 0,
      snippet, startPageNumber: pageNumber, endPageNumber: pageNumber,
    };
  } else if (event.type === "genie.thought") {
    const r = event as unknown as { thoughtType: string; label: string; bullets: string[] };
    chunk.genieThought = { thoughtType: r.thoughtType, label: r.label, bullets: r.bullets ?? [] };
  } else if (event.type === "genie.thinking") {
    chunk.genieThinking = true;
  } else if (event.type === "genie.done") {
    const r = event as unknown as { sql: string; tableData: { columns: string[]; rows: string[][] } | null; suggestedQuestions: string[]; conversationId: string; messageId: string };
    chunk.genieDone = { sql: r.sql ?? "", tableData: r.tableData ?? null, suggestedQuestions: r.suggestedQuestions ?? [], conversationId: r.conversationId ?? "", messageId: r.messageId ?? "" };
    if (r.sql) chunk.agentSource = { type: "sql", label: "SQL Query", detail: r.sql };
  }
  return chunk;
}

function cleanText(text: string): string {
  return text.replace(/<name>[^<]*<\/name>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Extract the actual text from an item's content array
function getItemText(item: { content?: Array<{ type: string; text?: string }> } | undefined): string {
  return item?.content?.find((c) => c.type === "output_text")?.text ?? "";
}

export async function* readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<ParsedChunk> {
  const decoder = new TextDecoder();
  let buffer = "";

  // Per-item delta accumulation (for stepped messages that stream deltas)
  let currentItemText = "";
  let currentItemStep: number | undefined;
  let hasStepField = false;

  // Live-streaming step tracking: stream text as it arrives, clear content on step change
  let liveStreamingStep: number | undefined;
  const classifiedSteps = new Set<number>();

  // Stepped messages sorted by step at response.completed
  const steppedMessages: Array<{ step: number; text: string }> = [];
  // Tool call names in order for labeling data results
  const toolCallNames: string[] = [];
  // Track last tool call name for pairing with its result
  let pendingToolName = "";

  // Timing flags — emit once per stream
  let firstTokenEmitted = false;
  let firstReasoningEmitted = false;
  let firstGenieThoughtEmitted = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const event = parseSSELine(trimmed);
      if (!event) continue;

      const raw = event as unknown as Record<string, unknown>;
      const step = raw.step as number | undefined;
      if (step !== undefined) {
        hasStepField = true;
        currentItemStep = step;
      }

      if (event.type === "response.output_text.delta" && event.delta) {
        if (!hasStepField) {
          // KA endpoint — stream directly
          if (!firstTokenEmitted) {
            firstTokenEmitted = true;
            yield { timingLog: { label: "First token", ts: Date.now() } };
          }
          yield { textDelta: event.delta };
        } else {
          // Agent endpoint — accumulate AND live-stream; reclassify prior steps on step change
          currentItemText += event.delta;
          if (step !== undefined && liveStreamingStep !== undefined && liveStreamingStep !== step) {
            yield { finalText: "" };
            classifiedSteps.add(liveStreamingStep);
          }
          if (step !== undefined) liveStreamingStep = step;
          if (!firstTokenEmitted) {
            firstTokenEmitted = true;
            yield { timingLog: { label: "First token", ts: Date.now() } };
          }
          yield { textDelta: event.delta };
        }

      } else if (event.type === "response.output_item.done") {
        const item = raw.item as {
          type?: string; name?: string; id?: string; call_id?: string;
          content?: Array<{ type: string; text?: string }>;
        } | undefined;

        if (item?.type === "function_call" && item.name) {
          // Tool call — emit reasoning immediately so user sees activity
          const toolName = item.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          toolCallNames.push(item.name);
          pendingToolName = toolName;
          if (!firstReasoningEmitted) {
            firstReasoningEmitted = true;
            yield { timingLog: { label: "First tool call", ts: Date.now() } };
          }
          yield { reasoningDelta: `Calling tool: ${toolName}\n` };
          const isGenie = /genie|organizational|volunteer/i.test(item.name);
          const isKA = /knowledge|^ka/i.test(item.name);
          yield { agentSource: { type: isGenie ? "sql" : isKA ? "kb" : "tool", label: toolName } };

        } else if (item?.type === "message") {
          const itemStep = currentItemStep;

          if (!hasStepField) {
            // KA endpoint — emit final text immediately
            const text = getItemText(item);
            if (text) {
              yield {
                finalText: text.replace(/^\[\^[^\]]+\]:.*$(\n|$)/gm, "").replace(/\n{3,}/g, "\n\n").trimEnd(),
              };
            }
          } else if (itemStep !== undefined) {
            // Stepped message — use accumulated delta text (matches what was streamed)
            steppedMessages.push({ step: itemStep, text: currentItemText });
          } else {
            // No-step message — tool result. Read from item.content (NOT currentItemText which is empty)
            const itemText = getItemText(item);
            if (!itemText) {
              // nothing to do
            } else if (/^<name>[^<]*<\/name>$/.test(itemText.trim())) {
              // Pure name tag — extract tool name for next result pairing
              const m = itemText.match(/<name>([^<]*)<\/name>/);
              if (m) pendingToolName = m[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            } else if (itemText.trimStart().startsWith("|")) {
              // Pipe-table data result — emit as agentSource with detail
              const label = pendingToolName || "Data Query";
              yield { agentSource: { type: "sql", label, detail: itemText } };
              pendingToolName = "";
            }
            // Other no-step messages (e.g. IEEE_AGENT_TEST) — discard
          }
        }

        // Reset per-item state
        currentItemText = "";
        currentItemStep = undefined;

      } else if (event.type === "response.completed") {
        yield { timingLog: { label: "Response completed", ts: Date.now() } };
        // Extract rich data from databricks_output trace if available
        const databricksOutput = (raw as Record<string, unknown>).databricks_output as Record<string, unknown> | undefined;
        const traceData = databricksOutput?.trace as Record<string, unknown> | undefined;
        const spans = (traceData?.data as Record<string, unknown> | undefined)?.spans as Array<Record<string, unknown>> | undefined;

        if (spans) {
          for (const span of spans) {
            const attrs = span.attributes as Record<string, string> | undefined;
            if (!attrs) continue;
            // Extract SQL query from tool spans
            const sqlQuery = attrs["sql_query"];
            const description = attrs["description"];
            if (sqlQuery) {
              const toolLabel = (span.name as string ?? "Data Query").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              const cleanSql = sqlQuery.replace(/^"|"$/g, "").replace(/\\n/g, "\n").replace(/\\"/g, '"');
              const cleanDesc = description ? description.replace(/^"|"$/g, "") : undefined;
              yield { agentSource: { type: "sql", label: toolLabel, detail: cleanSql, ...(cleanDesc ? { description: cleanDesc } : {}) } as AgentSource };
            }
          }
        }

        // Resolve stepped messages: highest step = final answer, rest = reasoning
        if (steppedMessages.length > 0) {
          steppedMessages.sort((a, b) => a.step - b.step);
          const last = steppedMessages[steppedMessages.length - 1];
          const prior = steppedMessages.slice(0, -1);

          for (const m of prior) {
            if (classifiedSteps.has(m.step)) continue; // already emitted live
            const clean = cleanText(m.text);
            if (clean) yield { reasoningDelta: clean + "\n" };
          }

          const clean = cleanText(last.text);
          if (clean) yield { finalText: clean };
        }

      } else {
        const chunk = processStreamEvent(event);
        if (chunk.genieThought && !firstGenieThoughtEmitted) {
          firstGenieThoughtEmitted = true;
          yield { timingLog: { label: "First Genie thought", ts: Date.now() } };
        }
        if (chunk.genieDone) {
          yield { timingLog: { label: "Genie query done", ts: Date.now() } };
        }
        if (chunk.reasoningDelta || chunk.citation || chunk.genieDone || chunk.genieThought || chunk.genieThinking) {
          yield chunk;
        }
      }
    }
  }

  // Safety net: stream ended without response.completed
  if (steppedMessages.length > 0) {
    steppedMessages.sort((a, b) => a.step - b.step);
    const clean = cleanText(steppedMessages[steppedMessages.length - 1].text);
    if (clean) yield { finalText: clean };
  } else if (currentItemText.trim() && !hasStepField) {
    yield { finalText: currentItemText.trimEnd() };
  }
}
