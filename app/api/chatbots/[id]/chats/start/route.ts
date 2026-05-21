/**
 * POST /api/chatbots/[id]/chats/start
 *
 * Atomically creates a new chat AND inserts the first user message in a single
 * DB transaction. This eliminates the race condition where a fire-and-forget
 * message POST could arrive before the chat row exists (FK violation → silent loss).
 *
 * Body: {
 *   chatId:    string   (client-generated UUID)
 *   title:     string
 *   createdAt: string   (ISO)
 *   message: {
 *     id:        string
 *     content:   string
 *     createdAt: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chats, messages, chatbots, chatbotAccess, userRoles, roles } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { upsertUser } from "@/lib/db/users";

async function canAccessChatbot(
  userId: string,
  roleIds: string[],
  chatbotId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const rows = await db
    .select()
    .from(chatbotAccess)
    .where(
      and(
        eq(chatbotAccess.chatbotId, chatbotId),
        or(
          eq(chatbotAccess.userId, userId),
          ...roleIds.map((rid) => eq(chatbotAccess.roleId, rid)),
        ),
      ),
    );
  return rows.length > 0;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await upsertUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  const { id: chatbotId } = await params;

  const userRoleRows = await db
    .select({ roleId: userRoles.roleId, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  const roleIds = userRoleRows.map((r) => r.roleId);
  const isAdmin = userRoleRows.some((r) => r.name === "admin");

  const hasAccess = await canAccessChatbot(user.id, roleIds, chatbotId, isAdmin);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [bot] = await db.select().from(chatbots).where(eq(chatbots.id, chatbotId));
  if (!bot) return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });

  const body = await req.json() as {
    chatId: string;
    title: string;
    createdAt: string;
    message: { id: string; content: string; createdAt: string };
  };

  // Single transaction: chat row + first message row — no race possible.
  await db.transaction(async (tx) => {
    await tx.insert(chats).values({
      id: body.chatId,
      userId: user.id,
      chatbotId,
      title: body.title,
      chatType: "chatbot",
      mode: bot.agentType,
      selectedItem: bot.agentId,
      createdAt: new Date(body.createdAt),
    });

    await tx.insert(messages).values({
      id: body.message.id,
      chatId: body.chatId,
      role: "user",
      content: body.message.content,
      createdAt: new Date(body.message.createdAt),
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
