import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chats, chatbots, chatbotAccess, messages, citations, messageTableData, messageFeedback, users, userRoles, roles } from "@/lib/db/schema";
import { desc, eq, and, or } from "drizzle-orm";
import { upsertUser } from "@/lib/db/users";

async function canAccessChatbot(userId: string, roleIds: string[], chatbotId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  const rows = await db
    .select()
    .from(chatbotAccess)
    .where(
      and(
        eq(chatbotAccess.chatbotId, chatbotId),
        or(
          eq(chatbotAccess.userId, userId),
          ...roleIds.map((rid) => eq(chatbotAccess.roleId, rid))
        )
      )
    );
  return rows.length > 0;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });

  const user = await upsertUser({ email: session.user.email, name: session.user.name, image: session.user.image });
  const { id: chatbotId } = await params;

  const userRoleRows = await db.select({ roleId: userRoles.roleId, name: roles.name })
    .from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, user.id));
  const roleIds = userRoleRows.map((r) => r.roleId);
  const isAdmin = userRoleRows.some((r) => r.name === "admin");

  const hasAccess = await canAccessChatbot(user.id, roleIds, chatbotId, isAdmin);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(chats)
    .where(and(eq(chats.userId, user.id), eq(chats.chatbotId, chatbotId)))
    .orderBy(desc(chats.createdAt));

  const result = await Promise.all(
    rows.map(async (chat) => {
      const msgs = await db.select().from(messages).where(eq(messages.chatId, chat.id)).orderBy(messages.createdAt);
      const fullMessages = await Promise.all(
        msgs.map(async (msg) => {
          const cits = await db.select().from(citations).where(eq(citations.messageId, msg.id));
          const [td] = await db.select().from(messageTableData).where(eq(messageTableData.messageId, msg.id));
          const [fb] = await db.select().from(messageFeedback).where(eq(messageFeedback.messageId, msg.id));
          return {
            id: msg.id, role: msg.role, content: msg.content,
            reasoning: msg.reasoning ?? undefined, sql: msg.sql ?? undefined,
            suggestedQuestions: msg.suggestedQuestions ?? undefined,
            genieSpaceId: msg.genieSpaceId ?? undefined,
            genieConversationId: msg.genieConversationId ?? undefined,
            genieMessageId: msg.genieMessageId ?? undefined,
            genieFeedback: fb ? { rating: fb.rating as "up" | "down", comment: fb.comment } : undefined,
            createdAt: msg.createdAt.toISOString(),
            citations: cits.map((c) => ({ type: c.type as "url_citation", title: c.title, url: c.url, annotationIndex: c.annotationIndex, snippet: c.snippet ?? undefined })),
            tableData: td ? { columns: td.columns, rows: td.rows as string[][] } : undefined,
          };
        })
      );
      return {
        id: chat.id, title: chat.title, mode: chat.mode ?? undefined,
        selectedItem: chat.selectedItem ?? undefined,
        genieConversationId: chat.genieConversationId ?? undefined,
        createdAt: chat.createdAt.toISOString(), messages: fullMessages,
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await upsertUser({ email: session.user.email, name: session.user.name, image: session.user.image });
  const { id: chatbotId } = await params;

  const userRoleRows = await db.select({ roleId: userRoles.roleId, name: roles.name })
    .from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, user.id));
  const roleIds = userRoleRows.map((r) => r.roleId);
  const isAdmin = userRoleRows.some((r) => r.name === "admin");

  const hasAccess = await canAccessChatbot(user.id, roleIds, chatbotId, isAdmin);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const bot = await db.select().from(chatbots).where(eq(chatbots.id, chatbotId));
  if (!bot.length) return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });

  const [created] = await db.insert(chats).values({
    id: body.id,
    userId: user.id,
    chatbotId,
    title: body.title,
    chatType: "chatbot",
    mode: bot[0].agentType,
    selectedItem: bot[0].agentId,
    createdAt: new Date(body.createdAt),
  }).returning();

  return NextResponse.json({ ...created, createdAt: created.createdAt.toISOString() }, { status: 201 });
}
