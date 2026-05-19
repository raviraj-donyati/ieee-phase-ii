import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chatbots, users, userRoles, roles } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { upsertUser } from "@/lib/db/users";

async function requireAdmin(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return null;
  const userRoleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  const isAdmin = userRoleRows.some((r) => r.name === "admin");
  return isAdmin ? user : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(chatbots).orderBy(desc(chatbots.createdAt));
  return NextResponse.json(rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, slug, agentType, agentId, logoUrl, isActive } = body;

  if (!name || !slug || !agentType || !agentId) {
    return NextResponse.json({ error: "Missing required fields: name, slug, agentType, agentId" }, { status: 400 });
  }

  const [created] = await db.insert(chatbots).values({
    name,
    description: description ?? null,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    agentType,
    agentId,
    logoUrl: logoUrl ?? null,
    isActive: isActive ?? true,
    createdBy: admin.id,
  }).returning();

  return NextResponse.json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}
