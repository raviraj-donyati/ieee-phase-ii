"use client";

import { useState } from "react";
import { Loader2, UserCheck, UserX, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  roles: { id: string; name: string }[];
}

interface UsersTableProps {
  users: UserRow[];
  allRoles: { id: string; name: string }[];
}

const roleBadge: Record<string, string> = {
  admin:  "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900/50",
  member: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50",
  viewer: "text-muted-foreground bg-muted border-border",
};

export default function UsersTable({ users: initialUsers, allRoles }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [saving, setSaving] = useState<string | null>(null);

  const updateUser = async (userId: string, patch: { isActive?: boolean; roleNames?: string[] }) => {
    setSaving(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              User
            </th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
              Role
            </th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
              Joined
            </th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => {
            const initials = user.name
              ? user.name.split(" ").map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("")
              : user.email[0].toUpperCase();

            return (
              <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
                {/* User */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold select-none">
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{user.name ?? user.email}</div>
                      {user.name && (
                        <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Roles */}
                <td className="px-5 py-4 hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.map((r) => (
                      <span
                        key={r.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          roleBadge[r.name] ?? roleBadge.viewer
                        )}
                      >
                        {r.name === "admin" && <Shield className="size-3" />}
                        {r.name}
                      </span>
                    ))}
                    {user.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No roles</span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
                    user.isActive
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50"
                      : "text-muted-foreground bg-muted border-border"
                  )}>
                    <span className={cn("size-1.5 rounded-full", user.isActive ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>

                {/* Joined */}
                <td className="px-5 py-4 text-xs text-muted-foreground hidden md:table-cell">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {saving === user.id && (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    )}

                    {/* Role selector */}
                    <select
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 cursor-pointer transition-all"
                      value={user.roles[0]?.name ?? ""}
                      onChange={(e) => updateUser(user.id, { roleNames: e.target.value ? [e.target.value] : [] })}
                      title="Change role"
                    >
                      <option value="">No role</option>
                      {allRoles.map((r) => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>

                    {/* Toggle active */}
                    <button
                      onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 font-medium transition-all border",
                        user.isActive
                          ? "text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/40"
                          : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-300 dark:hover:bg-emerald-950/40"
                      )}
                    >
                      {user.isActive
                        ? <><UserX className="size-3.5" /> Deactivate</>
                        : <><UserCheck className="size-3.5" /> Activate</>
                      }
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
