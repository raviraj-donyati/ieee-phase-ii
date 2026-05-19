import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { users, userRoles, roles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await requireAdmin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

  const result = await Promise.all(
    allUsers.map(async (u) => {
      const roleRows = await db
        .select({ id: roles.id, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id));
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        image: u.image,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        roles: roleRows,
      };
    })
  );

  return NextResponse.json(result);
}
