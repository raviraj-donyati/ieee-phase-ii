import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { chatbots, chatbotAccess, users, userRoles, roles } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";
import { upsertUser } from "@/lib/db/users";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });

  const user = await upsertUser({ email: session.user.email, name: session.user.name, image: session.user.image });

  // Get user's role IDs
  const userRoleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  const roleIds = userRoleRows.map((r) => r.roleId);

  const isAdmin = await (async () => {
    const adminRole = await db.select().from(roles).where(eq(roles.name, "admin"));
    return adminRole.length > 0 && roleIds.includes(adminRole[0].id);
  })();

  // Admins see all active chatbots
  if (isAdmin) {
    const all = await db.select().from(chatbots).where(eq(chatbots.isActive, true));
    return NextResponse.json(all.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })));
  }

  // Regular users: get chatbots granted to them directly or via their roles
  const accessRows = await db
    .select({ chatbotId: chatbotAccess.chatbotId })
    .from(chatbotAccess)
    .where(
      or(
        eq(chatbotAccess.userId, user.id),
        ...roleIds.map((rid) => eq(chatbotAccess.roleId, rid))
      )
    );

  if (accessRows.length === 0) return NextResponse.json([]);

  const chatbotIds = [...new Set(accessRows.map((r) => r.chatbotId))];
  const accessible = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.isActive, true)));

  const filtered = accessible.filter((b) => chatbotIds.includes(b.id));

  return NextResponse.json(filtered.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  })));
}
