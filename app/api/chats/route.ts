import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chats, messages, citations, messageTableData, messageFeedback } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { upsertUser } from "@/lib/db/users";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });

  const user = await upsertUser({ email: session.user.email, name: session.user.name, image: session.user.image });
  const chatType = req.nextUrl.searchParams.get("type") ?? "full";

  const rows = await db.select().from(chats)
    .where(and(eq(chats.userId, user.id), eq(chats.chatType, chatType)))
    .orderBy(desc(chats.createdAt));

  const result = await Promise.all(
    rows.map(async (chat) => {
      const msgs = await db.select().from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(messages.createdAt);

      const fullMessages = await Promise.all(
        msgs.map(async (msg) => {
          const cits = await db.select().from(citations).where(eq(citations.messageId, msg.id));
          const [td] = await db.select().from(messageTableData).where(eq(messageTableData.messageId, msg.id));
          const [fb] = await db.select().from(messageFeedback).where(eq(messageFeedback.messageId, msg.id));
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
            tableData: td
              ? { columns: td.columns, rows: td.rows as string[][] }
              : undefined,
          };
        })
      );

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
    })
  );

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
