"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChatbotRowProps {
  bot: {
    id: string;
    name: string;
    description: string | null;
    agentType: string;
    agentId: string;
    isActive: boolean;
  };
  badge: {
    label: string;
    cls: string;
    icon: React.ReactNode;
  };
}

export function ChatbotRow({ bot, badge }: ChatbotRowProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/chatbots/${bot.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`"${bot.name}" deleted`);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete chatbot");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr
        className="hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={(e) => {
          // Don't navigate if clicking a button/link inside the row
          if ((e.target as HTMLElement).closest("a, button")) return;
          window.location.href = `/admin/chatbots/${bot.id}`;
        }}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", badge.cls)}>
              {badge.icon}
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">{bot.name}</div>
              {bot.description && (
                <div className="text-xs text-muted-foreground truncate max-w-52 mt-0.5">{bot.description}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-4 hidden sm:table-cell">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", badge.cls)}>
            {badge.icon}{badge.label}
          </span>
        </td>
        <td className="px-5 py-4 hidden md:table-cell">
          <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{bot.agentId}</code>
        </td>
        <td className="px-5 py-4">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            bot.isActive
              ? "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50"
              : "text-muted-foreground bg-muted border border-border"
          )}>
            <span className={cn("size-1.5 rounded-full", bot.isActive ? "bg-emerald-500" : "bg-muted-foreground/40")} />
            {bot.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-5 py-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/admin/chatbots/${bot.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors bg-muted hover:bg-primary/10 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-primary/20"
            >
              <Pencil className="size-3" /> Edit
            </Link>
            <button
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors bg-muted hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-destructive/20"
            >
              <Trash2 className="size-3" /> Delete
            </button>
          </div>
        </td>
      </tr>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete chatbot?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{bot.name}</span> will be permanently deleted along with all its chats and access rules. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
