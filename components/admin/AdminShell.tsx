"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bot, Users, LogOut,
  Zap, MessageSquare, Sun, Moon, MessagesSquare,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useContext } from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { AdminHeaderContext, AdminHeaderProvider } from "@/components/admin/AdminPageHeader";

const navItems = [
  // Chatbots and Users panels removed — chatbots are auto-discovered from Databricks,
  // access is managed via Databricks endpoint permissions.
  // { href: "/admin/chatbots",   label: "Chatbots",   icon: Bot,             exact: false },
  // { href: "/admin/users",      label: "Users",      icon: Users,           exact: false },
  { href: "/admin/playground", label: "Playground", icon: MessageSquare,   exact: false },
];

interface AdminShellProps {
  children: React.ReactNode;
  user: { name: string | null; email: string };
}

function AdminShellInner({ children, user }: AdminShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { slot } = useContext(AdminHeaderContext);

  const initials = user.name
    ? user.name.split(" ").map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("")
    : user.email[0].toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full overflow-hidden">

          {/* ── Sidebar ── */}
          <Sidebar collapsible="offcanvas">
            <SidebarHeader className="px-3 pt-3 pb-2 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5 py-1">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Zap className="size-4" />
                </div>
                <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                  <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">Admin Console</span>
                  <span className="text-[10px] text-sidebar-foreground/40 mt-0.5">Platform Management</span>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-2 gap-0 pt-2">
              <SidebarGroup className="px-0">
                <SidebarGroupLabel className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none">
                  Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {navItems.map(({ href, label, icon: Icon, exact }) => {
                      const active = exact ? pathname === href : pathname.startsWith(href);
                      return (
                        <SidebarMenuItem key={href}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={label}
                            className={cn(
                              "h-9 rounded-lg px-3 font-medium transition-all duration-150",
                              active
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent border border-transparent"
                            )}
                          >
                            <Link href={href}>
                              <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/50")} />
                              <span>{label}</span>
                              {active && <span className="ml-auto size-1.5 rounded-full bg-primary shrink-0 group-data-[collapsible=icon]:hidden" />}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* ── My Chat ── */}
              <SidebarGroup className="px-0 mt-1">
                <SidebarGroupLabel className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none">
                  Personal
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip="My Chat"
                        className="h-9 rounded-lg px-3 font-medium transition-all duration-150 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent border border-transparent"
                      >
                        <Link href="/chat">
                          <MessagesSquare className="size-4 shrink-0 text-sidebar-foreground/50" />
                          <span>My Chat</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-2 pt-2 pb-3 border-t border-sidebar-border">
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-sidebar-accent/60 group-data-[collapsible=icon]:justify-center">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold select-none">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-xs font-medium text-sidebar-foreground truncate leading-none">{user.name ?? user.email}</p>
                  {user.name && <p className="text-[10px] text-sidebar-foreground/45 truncate mt-0.5">{user.email}</p>}
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="Sign out"
                  className="shrink-0 p-1 rounded-md text-sidebar-foreground/35 hover:text-destructive hover:bg-destructive/10 transition-all group-data-[collapsible=icon]:hidden"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            </SidebarFooter>
          </Sidebar>

          {/* ── Main area ── */}
          <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">

            {/* Header bar — breadcrumbs + actions slot in from each page */}
            <header className="flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4">
              <SidebarTrigger className="shrink-0" />
              <Separator orientation="vertical" className="mx-1 my-3" />

              {/* Breadcrumbs (or fallback) */}
              <div className="flex-1 min-w-0">
                {slot?.breadcrumbs ?? (
                  <span className="text-sm font-semibold text-foreground truncate">Admin</span>
                )}
              </div>

              {/* Page action buttons */}
              {slot?.actions && (
                <div className="flex items-center gap-2 shrink-0">
                  {slot.actions}
                </div>
              )}

              <Separator orientation="vertical" className="mx-1 my-3" />

              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
                className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </header>

            {/* Scrollable page content */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-background">
              {children}
            </div>

          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function AdminShell({ children, user }: AdminShellProps) {
  return (
    <AdminHeaderProvider>
      <AdminShellInner user={user}>{children}</AdminShellInner>
    </AdminHeaderProvider>
  );
}
