import { getUserChatbots } from "@/lib/db/chat-page-data";
import { UserChatLayout } from "@/components/chat/UserChatLayout";

export default async function ChatPage() {
  const { chatbots, isAdmin } = await getUserChatbots();
  return <UserChatLayout chatbots={chatbots} isAdmin={isAdmin} />;
}
