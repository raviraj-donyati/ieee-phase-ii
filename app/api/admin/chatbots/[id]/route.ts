import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chatbots, users, userRoles, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function requireAdmin(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return null;
  const userRoleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  return userRoleRows.some((r) => r.name === "admin") ? user : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [bot] = await db.select().from(chatbots).where(eq(chatbots.id, id));
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...bot, createdAt: bot.createdAt.toISOString(), updatedAt: bot.updatedAt.toISOString() });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, description, slug, agentType, agentId, logoUrl, isActive } = body;

  const [updated] = await db
    .update(chatbots)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(slug !== undefined && { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") }),
      ...(agentType !== undefined && { agentType }),
      ...(agentId !== undefined && { agentId }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    .where(eq(chatbots.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.delete(chatbots).where(eq(chatbots.id, id));
  return NextResponse.json({ success: true });
}
