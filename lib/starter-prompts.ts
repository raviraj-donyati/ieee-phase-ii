import { Brain, Sparkles, Bot } from "lucide-react";

export interface ModeCard {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  prompt: string;
}

export interface AgentMeta {
  icon: React.ElementType;
  label: string;
  color: string;
  starters: string[];
}

/** Used in ChatWindow (multi-mode dashboard) */
export const modeCards: ModeCard[] = [
  {
    id: "ka",
    icon: Brain,
    title: "Knowledge Assistant",
    description: "Search internal knowledge bases, policies, and documentation.",
    color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
    prompt: "What can you help me find?",
  },
  {
    id: "genie",
    icon: Sparkles,
    title: "Genie Space",
    description: "Ask questions in plain English and get live data from Databricks.",
    color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50",
    prompt: "Show me the latest data",
  },
  {
    id: "supervisor",
    icon: Bot,
    title: "Supervisor Agent",
    description: "Delegate multi-step tasks to an AI agent that plans and uses tools.",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50",
    prompt: "Help me with a complex task",
  },
];

/** Used in ChatbotWindow (single-chatbot mode) */
export const agentMeta: Record<string, AgentMeta> = {
  ka: {
    icon: Brain,
    label: "Knowledge Assistant",
    color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
    starters: [
      "What topics can you help me with?",
      "Summarize the latest policy updates",
      "Find documentation on onboarding",
    ],
  },
  genie: {
    icon: Sparkles,
    label: "Genie Space",
    color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50",
    starters: [
      "Show me the top 10 records",
      "What are the trends this month?",
      "Compare data from last quarter",
    ],
  },
  supervisor: {
    icon: Bot,
    label: "Supervisor Agent",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50",
    starters: [
      "Help me plan a multi-step task",
      "Analyze and summarize this data",
      "What tools do you have access to?",
    ],
  },
};
