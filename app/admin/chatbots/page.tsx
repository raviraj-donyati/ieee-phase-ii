import { db } from "@/lib/db";
import { chatbots } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { Plus, Bot, Brain, Sparkles } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChatbotRow } from "@/components/admin/ChatbotRow";

const agentBadge: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  ka: {
    label: "Knowledge Assistant",
    cls: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
    icon: <Brain className="size-3" />,
  },
  genie: {
    label: "Genie Space",
    cls: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50",
    icon: <Sparkles className="size-3" />,
  },
  supervisor: {
    label: "Supervisor Agent",
    cls: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50",
    icon: <Bot className="size-3" />,
  },
};
export default async function AdminChatbotsPage() {
  const rows = await db.select().from(chatbots).orderBy(desc(chatbots.createdAt));
  const activeCount = rows.filter((r) => r.isActive).length;

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
              <BreadcrumbItem><BreadcrumbPage>Chatbots</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <Link
            href="/admin/chatbots/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="size-3.5" />
            New Chatbot
          </Link>
        }
      />

      <div className="p-6 sm:p-8 w-full page-enter">
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">
            {rows.length} chatbot{rows.length !== 1 ? "s" : ""} configured
            {activeCount > 0 && ` · ${activeCount} active`}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl border bg-card">
            <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
              <Bot className="size-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No chatbots yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first chatbot to get started.</p>
            </div>
            <Link
              href="/admin/chatbots/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-4" /> Create Chatbot
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Agent ID</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((bot) => {
                  const badge = agentBadge[bot.agentType] ?? agentBadge.ka;
                  return (
                    <ChatbotRow key={bot.id} bot={bot} badge={badge} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
