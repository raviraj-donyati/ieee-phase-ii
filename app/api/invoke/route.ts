import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { endpoint, messages, conversationId, chatId } = await req.json();

  // Check endpoint is READY — short timeout, non-fatal if it times out
  try {
    const healthRes = await databricksFetch(`${HOST}/api/2.0/serving-endpoints/${endpoint}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      timeoutMs: 5_000,
    });
    if (healthRes.ok) {
      const health = await healthRes.json();
      const ready = health?.state?.ready;
      if (ready && ready !== "READY") {
        return new Response(
          JSON.stringify({ error: `Endpoint "${endpoint}" is not ready (state: ${ready}). Please try again later.` }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  } catch {
    // Health check timed out or failed — proceed anyway and let the invocation fail if needed
  }

  const userId = session?.user?.email ?? "user@example.com";
  const body = {
    stream: true,
    input: messages,
    databricks_options: { conversation_id: conversationId, return_trace: true, long_task: true },
    context: { conversation_id: conversationId, user_id: userId },
  };

  const upstream = await databricksFetch(`${HOST}/serving-endpoints/${endpoint}/invocations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
