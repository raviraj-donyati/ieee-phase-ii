"use client";

import { Brain, Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMode } from "@/types";

const MODES: {
  id: ChatMode;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
}[] = [
  {
    id: "ka",
    label: "Knowledge Assistant",
    shortLabel: "KA",
    icon: Brain,
    color: "text-blue-600 dark:text-blue-400",
    activeColor: "bg-blue-600 text-white dark:bg-blue-500",
  },
  {
    id: "genie",
    label: "Genie Space",
    shortLabel: "Genie",
    icon: Sparkles,
    color: "text-purple-600 dark:text-purple-400",
    activeColor: "bg-purple-600 text-white dark:bg-purple-500",
  },
  {
    id: "supervisor",
    label: "Supervisor Agent",
    shortLabel: "Supervisor",
    icon: Bot,
    color: "text-emerald-600 dark:text-emerald-400",
    activeColor: "bg-emerald-600 text-white dark:bg-emerald-500",
  },
];

interface ModeSelectorProps {
  selected: ChatMode;
  onChange: (mode: ChatMode) => void;
}

export function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border">
      {MODES.map(({ id, label, shortLabel, icon: Icon, color, activeColor }) => {
        const isActive = selected === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={label}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
              isActive
                ? `${activeColor} shadow-sm`
                : `text-muted-foreground hover:text-foreground hover:bg-background/70`
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", isActive ? "" : color)} />
            <span className="hidden sm:inline">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
