import Link from "next/link";
import ChatbotForm from "@/components/admin/ChatbotForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function NewChatbotPage() {
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
              <BreadcrumbItem><BreadcrumbPage>New Chatbot</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />

      <div className="p-6 sm:p-8 w-full page-enter">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground tracking-tight">New Chatbot</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure a chatbot and map it to an AI agent.</p>
        </div>
        <ChatbotForm />
      </div>
    </>
  );
}
