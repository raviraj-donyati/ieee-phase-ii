import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chatbotAccess, users, userRoles, roles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function requireAdmin(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return null;
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  return rows.some((r) => r.name === "admin") ? user : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rows = await db
    .select({
      id: chatbotAccess.id,
      chatbotId: chatbotAccess.chatbotId,
      userId: chatbotAccess.userId,
      roleId: chatbotAccess.roleId,
      grantedAt: chatbotAccess.grantedAt,
      userName: users.name,
      userEmail: users.email,
      roleName: roles.name,
    })
    .from(chatbotAccess)
    .leftJoin(users, eq(chatbotAccess.userId, users.id))
    .leftJoin(roles, eq(chatbotAccess.roleId, roles.id))
    .where(eq(chatbotAccess.chatbotId, id));

  return NextResponse.json(rows.map((r) => ({ ...r, grantedAt: r.grantedAt.toISOString() })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: chatbotId } = await params;
  const { userId, roleId } = await req.json();

  if (!userId && !roleId) {
    return NextResponse.json({ error: "Provide userId or roleId" }, { status: 400 });
  }

  const [created] = await db.insert(chatbotAccess).values({
    chatbotId,
    userId: userId ?? null,
    roleId: roleId ?? null,
    grantedBy: admin.id,
  }).returning();

  return NextResponse.json({ ...created, grantedAt: created.grantedAt.toISOString() }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: chatbotId } = await params;
  const { accessId } = await req.json();

  await db
    .delete(chatbotAccess)
    .where(and(eq(chatbotAccess.id, accessId), eq(chatbotAccess.chatbotId, chatbotId)));

  return NextResponse.json({ success: true });
}
