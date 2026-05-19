import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, citations, messageTableData } from "@/lib/db/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: chatId } = await params;
  const body = await req.json();

  const [msg] = await db.insert(messages).values({
    id: body.id,
    chatId,
    role: body.role,
    content: body.content,
    reasoning: body.reasoning ?? null,
    genieThoughts: body.genieThoughts?.length ? body.genieThoughts : null,
    sql: body.sql ?? null,
    suggestedQuestions: body.suggestedQuestions ?? null,
    genieSpaceId: body.genieSpaceId ?? null,
    genieConversationId: body.genieConversationId ?? null,
    genieMessageId: body.genieMessageId ?? null,
    createdAt: new Date(body.createdAt),
  }).returning();

  if (body.citations?.length) {
    await db.insert(citations).values(
      body.citations.map((c: {
        type: string; title: string; url: string; annotationIndex: number;
        snippet?: string; startPageNumber?: number; endPageNumber?: number;
      }) => ({
        messageId: msg.id,
        type: c.type,
        title: c.title,
        url: c.url,
        annotationIndex: c.annotationIndex,
        snippet: c.snippet ?? null,
        startPageNumber: c.startPageNumber ?? null,
        endPageNumber: c.endPageNumber ?? null,
      }))
    );
  }

  if (body.tableData?.columns?.length) {
    await db.insert(messageTableData).values({
      messageId: msg.id,
      columns: body.tableData.columns,
      rows: body.tableData.rows,
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
