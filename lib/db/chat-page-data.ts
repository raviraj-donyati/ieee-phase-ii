import { db } from "./index";
import { chatbots, chatbotAccess, users, userRoles, roles } from "./schema";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export type SerializedChatbot = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  agentType: "ka" | "genie" | "supervisor";
  agentId: string;
  logoUrl: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Shared data fetch for /chat and /chat/[chatId] pages.
 * Returns the list of chatbots the current user can access.
 * Redirects to /login or /admin as needed.
 */
export async function getUserChatbots(): Promise<SerializedChatbot[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const email = session.user.email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) redirect("/login");

  const roleRows = await db
    .select({ roleId: userRoles.roleId, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const roleIds = roleRows.map((r) => r.roleId);
  const isAdmin = roleRows.some((r) => r.name === "admin");

  if (isAdmin) redirect("/admin");

  // Fetch access grants and all active chatbots in parallel
  const [accessRows, allChatbots] = await Promise.all([
    roleIds.length > 0
      ? db
          .select({ chatbotId: chatbotAccess.chatbotId })
          .from(chatbotAccess)
          .where(
            or(
              eq(chatbotAccess.userId, user.id),
              ...roleIds.map((rid) => eq(chatbotAccess.roleId, rid))
            )
          )
      : db
          .select({ chatbotId: chatbotAccess.chatbotId })
          .from(chatbotAccess)
          .where(eq(chatbotAccess.userId, user.id)),
    db.select().from(chatbots).where(eq(chatbots.isActive, true)),
  ]);

  const chatbotIds = new Set(accessRows.map((r) => r.chatbotId));
  const accessible = allChatbots.filter((b) => chatbotIds.has(b.id));

  return accessible.map((b) => ({
    ...b,
    agentType: b.agentType as "ka" | "genie" | "supervisor",
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));
}
