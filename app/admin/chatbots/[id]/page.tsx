import { db } from "@/lib/db";
import { chatbots, users, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import ChatbotForm from "@/components/admin/ChatbotForm";
import AccessManager from "@/components/admin/AccessManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditChatbotPage({ params }: Props) {
  const { id } = await params;
  const [bot] = await db.select().from(chatbots).where(eq(chatbots.id, id));
  if (!bot) notFound();

  const allUsers = await db.select({ id: users.id, email: users.email, name: users.name }).from(users);
  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);

  const chatbot = {
    ...bot,
    agentType: bot.agentType as "ka" | "genie" | "supervisor",
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  };

  return (
    <>
      <AdminPageHeader
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link href="/admin">Admin</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link href="/admin/chatbots">Chatbots</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate max-w-48">{bot.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />

      <div className="p-6 sm:p-8 w-full page-enter">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Edit Chatbot</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{bot.name}</p>
        </div>

        <ChatbotForm chatbot={chatbot} />

        {/* Access control section */}
        <div className="mt-10 pt-8 border-t">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Lock className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Access Control</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage which users and roles can access this chatbot.</p>
            </div>
          </div>
          <AccessManager chatbotId={id} users={allUsers} roles={allRoles} />
        </div>
      </div>
    </>
  );
}
