import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { chatbots, chatbotAccess, users, userRoles, roles } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";
import { ChatbotChatLayout } from "@/components/chat/ChatbotChatLayout";

interface Props {
  params: Promise<{ chatbotId: string; chatId: string }>;
}

export default async function ChatbotChatPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const { chatbotId, chatId } = await params;
  const [bot] = await db.select().from(chatbots).where(eq(chatbots.id, chatbotId));
  if (!bot || !bot.isActive) notFound();

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

  if (!isAdmin) {
    const accessCheck = roleIds.length > 0
      ? await db.select().from(chatbotAccess).where(
          and(
            eq(chatbotAccess.chatbotId, chatbotId),
            or(
              eq(chatbotAccess.userId, user.id),
              ...roleIds.map((rid) => eq(chatbotAccess.roleId, rid))
            )
          )
        )
      : await db.select().from(chatbotAccess).where(
          and(eq(chatbotAccess.chatbotId, chatbotId), eq(chatbotAccess.userId, user.id))
        );

    if (accessCheck.length === 0) notFound();
  }

  const chatbot = {
    ...bot,
    agentType: bot.agentType as "ka" | "genie" | "supervisor",
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  };

  return <ChatbotChatLayout chatbot={chatbot} initialChatId={chatId} />;
}
