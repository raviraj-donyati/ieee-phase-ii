import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messageFeedback, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

async function saveToDb(localMessageId: string, rating: string, comment?: string) {
  const [msg] = await db.select({ id: messages.id }).from(messages).where(eq(messages.id, localMessageId));
  if (!msg) return;
  if (rating === "NONE") {
    await db.delete(messageFeedback).where(eq(messageFeedback.messageId, localMessageId));
  } else {
    await db.insert(messageFeedback)
      .values({ messageId: localMessageId, rating: rating === "POSITIVE" ? "up" : "down", comment: comment ?? null })
      .onConflictDoUpdate({
        target: messageFeedback.messageId,
        set: { rating: rating === "POSITIVE" ? "up" : "down", comment: comment ?? null, updatedAt: new Date() },
      });
  }
}

export async function POST(req: NextRequest) {
  const { spaceId, conversationId, messageId, rating, comment, localMessageId } = await req.json();

  if (!rating || !localMessageId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Always persist to DB first
  await saveToDb(localMessageId, rating, comment);

  // Send to Databricks only if Genie IDs are present
  if (spaceId && conversationId && messageId) {
    const url = `${HOST}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}/feedback`;
    const body = JSON.stringify({ rating, ...(comment ? { comment } : {}) });

    const res = await databricksFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body,
      timeoutMs: 10_000,
    });

    const resText = await res.text();

    if (!res.ok) {
      return NextResponse.json({ error: `Databricks feedback failed: ${res.status}`, detail: resText }, { status: res.status });
    }
  }

  return NextResponse.json({ ok: true });
}
