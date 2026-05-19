"use client";

import Link from "next/link";
import { Bot, Brain, Sparkles, ArrowRight, MessageSquare } from "lucide-react";
import { Chatbot } from "@/types";
import { cn } from "@/lib/utils";

const agentMeta: Record<string, {
  icon: React.ReactNode;
  label: string;
  badgeCls: string;
  iconBgCls: string;
}> = {
  ka: {
    icon: <Brain className="size-4" />,
    label: "Knowledge Assistant",
    badgeCls: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
    iconBgCls: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
  },
  genie: {
    icon: <Sparkles className="size-4" />,
    label: "Genie Space",
    badgeCls: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50",
    iconBgCls: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900/50",
  },
  supervisor: {
    icon: <Bot className="size-4" />,
    label: "Supervisor Agent",
    badgeCls: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50",
    iconBgCls: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50",
  },
};

interface ChatbotCardProps {
  chatbot: Chatbot;
}

export function ChatbotCard({ chatbot }: ChatbotCardProps) {
  const meta = agentMeta[chatbot.agentType] ?? agentMeta.ka;

  return (
    <Link
      href={`/c/${chatbot.id}`}
      className="group relative flex flex-col gap-4 rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", meta.iconBgCls)}>
          {meta.icon}
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
          <span className="text-xs font-medium text-primary">Open</span>
          <ArrowRight className="size-3.5 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1.5 min-w-0 flex-1">
        <h3 className="font-semibold text-base text-foreground truncate group-hover:text-primary transition-colors">
          {chatbot.name}
        </h3>
        {chatbot.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {chatbot.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">No description</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          meta.badgeCls
        )}>
          <span className="[&>svg]:size-3">{meta.icon}</span>
          {meta.label}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          <MessageSquare className="size-3" />
          Chat
        </span>
      </div>
    </Link>
  );
}
