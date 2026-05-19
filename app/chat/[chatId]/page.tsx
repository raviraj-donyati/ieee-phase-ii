import { getUserChatbots } from "@/lib/db/chat-page-data";
import { UserChatLayout } from "@/components/chat/UserChatLayout";

interface Props {
  params: Promise<{ chatId: string }>;
}

export default async function ChatWithIdPage({ params }: Props) {
  const { chatId } = await params;
  const chatbots = await getUserChatbots();
  return <UserChatLayout chatbots={chatbots} initialChatId={chatId} />;
}
