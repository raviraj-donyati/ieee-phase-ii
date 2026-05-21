/**
 * POST /api/chats/start
 *
 * Atomically creates a user chat AND inserts the first user message in a single
 * DB transaction — same pattern as /api/chatbots/[id]/chats/start.
 *
 * Body: {
 *   chatId:      string
 *   title:       string
 *   createdAt:   string  (ISO)
 *   chatbotId:   string
 *   mode:        string
 *   selectedItem: string
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
import { chats, messages } from "@/lib/db/schema";
import { upsertUser } from "@/lib/db/users";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await upsertUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  const body = await req.json() as {
    chatId: string;
    title: string;
    createdAt: string;
    chatbotId: string;
    mode: string;
    selectedItem: string;
    message: { id: string; content: string; createdAt: string };
  };

  await db.transaction(async (tx) => {
    await tx.insert(chats).values({
      id: body.chatId,
      userId: user.id,
      chatbotId: body.chatbotId,
      title: body.title,
      chatType: "user",
      mode: body.mode,
      selectedItem: body.selectedItem,
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
