import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const [updated] = await db.update(chats)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.mode !== undefined && { mode: body.mode }),
      ...(body.selectedItem !== undefined && { selectedItem: body.selectedItem }),
      ...(body.genieConversationId !== undefined && { genieConversationId: body.genieConversationId }),
    })
    .where(eq(chats.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...updated, createdAt: updated.createdAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(chats).where(eq(chats.id, id));
  return NextResponse.json({ ok: true });
}
