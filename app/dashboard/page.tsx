import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chatbots, chatbotAccess, users, userRoles, roles } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";
import { ChatbotCard } from "@/components/dashboard/ChatbotCard";
import { signOut } from "next-auth/react";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const email = session.user.email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) redirect("/login");

  const userRoleRows = await db
    .select({ roleId: userRoles.roleId, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  const roleIds = userRoleRows.map((r) => r.roleId);
  const isAdmin = userRoleRows.some((r) => r.name === "admin");

  let accessible: typeof chatbots.$inferSelect[] = [];

  if (isAdmin) {
    accessible = await db.select().from(chatbots).where(eq(chatbots.isActive, true));
  } else {
    const accessRows = roleIds.length > 0
      ? await db
          .select({ chatbotId: chatbotAccess.chatbotId })
          .from(chatbotAccess)
          .where(
            or(
              eq(chatbotAccess.userId, user.id),
              ...roleIds.map((rid) => eq(chatbotAccess.roleId, rid))
            )
          )
      : await db
          .select({ chatbotId: chatbotAccess.chatbotId })
          .from(chatbotAccess)
          .where(eq(chatbotAccess.userId, user.id));

    const chatbotIds = [...new Set(accessRows.map((r) => r.chatbotId))];
    if (chatbotIds.length > 0) {
      const all = await db.select().from(chatbots).where(eq(chatbots.isActive, true));
      accessible = all.filter((b) => chatbotIds.includes(b.id));
    }
  }

  const serialized = accessible.map((b) => ({
    ...b,
    agentType: b.agentType as "ka" | "genie" | "supervisor",
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  return (
    <DashboardClient
      chatbots={serialized}
      user={{ name: user.name, email: user.email, isAdmin }}
    />
  );
}
