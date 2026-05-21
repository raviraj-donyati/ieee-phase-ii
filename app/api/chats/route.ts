import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chats, messages, citations, messageTableData, messageFeedback } from "@/lib/db/schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import { upsertUser } from "@/lib/db/users";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });

  const user = await upsertUser({ email: session.user.email, name: session.user.name, image: session.user.image });
  const chatType = req.nextUrl.searchParams.get("type") ?? "full";

  const chatRows = await db.select().from(chats)
    .where(and(eq(chats.userId, user.id), eq(chats.chatType, chatType)))
    .orderBy(desc(chats.createdAt));

  if (chatRows.length === 0) return NextResponse.json([]);

  const chatIds = chatRows.map((c) => c.id);

  // Fetch all related data in 4 bulk queries instead of N×3 individual ones.
  const [allMessages, allCitations, allTableData, allFeedback] = await Promise.all([
    db.select().from(messages).where(inArray(messages.chatId, chatIds)).orderBy(messages.createdAt),
    db.select().from(citations).where(
      inArray(citations.messageId,
        db.select({ id: messages.id }).from(messages).where(inArray(messages.chatId, chatIds))
      )
    ),
    db.select().from(messageTableData).where(
      inArray(messageTableData.messageId,
        db.select({ id: messages.id }).from(messages).where(inArray(messages.chatId, chatIds))
      )
    ),
    db.select().from(messageFeedback).where(
      inArray(messageFeedback.messageId,
        db.select({ id: messages.id }).from(messages).where(inArray(messages.chatId, chatIds))
      )
    ),
  ]);

  // Index by ID for O(1) lookups.
  const citsByMsgId = new Map<string, typeof allCitations>();
  for (const c of allCitations) {
    const arr = citsByMsgId.get(c.messageId) ?? [];
    arr.push(c);
    citsByMsgId.set(c.messageId, arr);
  }
  const tdByMsgId = new Map(allTableData.map((td) => [td.messageId, td]));
  const fbByMsgId = new Map(allFeedback.map((fb) => [fb.messageId, fb]));
  const msgsByChatId = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const arr = msgsByChatId.get(m.chatId) ?? [];
    arr.push(m);
    msgsByChatId.set(m.chatId, arr);
  }

  const result = chatRows.map((chat) => {
    const msgs = msgsByChatId.get(chat.id) ?? [];
    const fullMessages = msgs.map((msg) => {
      const cits = citsByMsgId.get(msg.id) ?? [];
      const td = tdByMsgId.get(msg.id);
      const fb = fbByMsgId.get(msg.id);
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        reasoning: msg.reasoning ?? undefined,
        genieThoughts: (msg.genieThoughts as import("@/types").GenieThought[] | null) ?? undefined,
        sql: msg.sql ?? undefined,
        suggestedQuestions: msg.suggestedQuestions ?? undefined,
        genieSpaceId: msg.genieSpaceId ?? undefined,
        genieConversationId: msg.genieConversationId ?? undefined,
        genieMessageId: msg.genieMessageId ?? undefined,
        genieFeedback: fb ? { rating: fb.rating as "up" | "down", comment: fb.comment } : undefined,
        createdAt: msg.createdAt.toISOString(),
        citations: cits.map((c) => ({
          type: c.type as "url_citation",
          title: c.title,
          url: c.url,
          annotationIndex: c.annotationIndex,
          snippet: c.snippet ?? undefined,
          startPageNumber: c.startPageNumber ?? undefined,
          endPageNumber: c.endPageNumber ?? undefined,
        })),
        tableData: td ? { columns: td.columns, rows: td.rows as string[][] } : undefined,
      };
    });

    return {
      id: chat.id,
      title: chat.title,
      chatbotId: chat.chatbotId ?? undefined,
      mode: chat.mode ?? undefined,
      selectedItem: chat.selectedItem ?? undefined,
      genieConversationId: chat.genieConversationId ?? undefined,
      createdAt: chat.createdAt.toISOString(),
      messages: fullMessages,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await upsertUser({ email: session.user.email, name: session.user.name, image: session.user.image });
  const body = await req.json();

  const [created] = await db.insert(chats).values({
    id: body.id,
    userId: user?.id ?? null,
    chatbotId: body.chatbotId ?? null,
    title: body.title,
    chatType: body.chatType ?? "full",
    mode: body.mode ?? null,
    selectedItem: body.selectedItem ?? null,
    createdAt: new Date(body.createdAt),
  }).returning();

  return NextResponse.json({ ...created, createdAt: created.createdAt.toISOString() }, { status: 201 });
}
