"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { Bot, LogOut, ShieldCheck, Zap } from "lucide-react";
import { ChatbotCard } from "@/components/dashboard/ChatbotCard";
import { Chatbot } from "@/types";
import { Button } from "@/components/ui/button";

interface DashboardClientProps {
  chatbots: Chatbot[];
  user: { name: string | null; email: string; isAdmin: boolean };
}

export default function DashboardClient({ chatbots, user }: DashboardClientProps) {
  const initials = user.name
    ? user.name.split(" ").map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("")
    : user.email[0].toUpperCase();

  const firstName = user.name?.split(" ")[0];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top nav ── */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Zap className="size-4" />
            </div>
            <span className="font-semibold text-sm text-foreground hidden sm:block">AI Platform</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {user.isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <ShieldCheck className="size-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
          </div>

          {/* User */}
          <div className="flex items-center gap-2 border-l pl-3 ml-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground truncate max-w-32 leading-none">
                {user.name ?? user.email}
              </span>
              {user.name && (
                <span className="text-[10px] text-muted-foreground truncate max-w-32 mt-0.5">
                  {user.email}
                </span>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all ml-1"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-enter">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {firstName ? `Welcome back, ${firstName} 👋` : "Welcome 👋"}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            {chatbots.length === 0
              ? "No chatbots have been assigned to you yet. Contact your admin."
              : `You have access to ${chatbots.length} chatbot${chatbots.length !== 1 ? "s" : ""}.`}
          </p>
        </div>

        {chatbots.length === 0 ? (
          <div className="flex flex-col items-center gap-5 py-20 text-center rounded-2xl border border-dashed bg-card">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <Bot className="size-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No chatbots yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask your admin to grant you access to a chatbot.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Your Chatbots
              </h2>
              <span className="text-xs text-muted-foreground">
                {chatbots.length} available
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {chatbots.map((bot) => (
                <ChatbotCard key={bot.id} chatbot={bot} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
