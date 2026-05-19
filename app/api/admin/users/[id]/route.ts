import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { users, userRoles, roles } from "@/lib/db/schema";
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Update isActive if provided
  if (body.isActive !== undefined) {
    await db.update(users).set({ isActive: body.isActive, updatedAt: new Date() }).where(eq(users.id, id));
  }

  // Update roles if provided (replace all)
  if (body.roleNames !== undefined) {
    const roleNames: string[] = body.roleNames;
    // Remove existing roles
    await db.delete(userRoles).where(eq(userRoles.userId, id));
    // Add new roles
    for (const roleName of roleNames) {
      const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
      if (role) {
        await db.insert(userRoles).values({ userId: id, roleId: role.id, grantedBy: admin.id }).onConflictDoNothing();
      }
    }
  }

  const [updated] = await db.select().from(users).where(eq(users.id, id));
  const roleRows = await db
    .select({ id: roles.id, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, id));

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    isActive: updated.isActive,
    roles: roleRows,
  });
}
