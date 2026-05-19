"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Plus, UserPlus, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccessRow {
  id: string;
  userId: string | null;
  roleId: string | null;
  userEmail: string | null;
  userName: string | null;
  roleName: string | null;
  grantedAt: string;
}

interface AccessManagerProps {
  chatbotId: string;
  users: { id: string; email: string; name: string | null }[];
  roles: { id: string; name: string }[];
}

const selectCls = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all cursor-pointer";

export default function AccessManager({ chatbotId, users, roles }: AccessManagerProps) {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<"user" | "role" | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/chatbots/${chatbotId}/access`)
      .then((r) => r.json())
      .then((data) => setRows(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [chatbotId]);

  const grant = async () => {
    if (!selectedId || !addMode) return;
    setSaving(true);
    await fetch(`/api/admin/chatbots/${chatbotId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addMode === "user" ? { userId: selectedId } : { roleId: selectedId }),
    });
    setAddMode(null);
    setSelectedId("");
    setSaving(false);
    load();
  };

  const revoke = async (accessId: string) => {
    setRevoking(accessId);
    await fetch(`/api/admin/chatbots/${chatbotId}/access`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessId }),
    });
    setRevoking(null);
    load();
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-4 animate-spin" />
          Loading access list…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center rounded-xl border border-dashed bg-muted/30">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center">
            <Users className="size-5 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No access granted yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add users or roles to grant access to this chatbot.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Granted To
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Granted
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    {row.userId ? (
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold select-none">
                          {(row.userName ?? row.userEmail ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{row.userName ?? row.userEmail}</span>
                          {row.userName && (
                            <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                          <Shield className="size-3.5" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{row.roleName}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      row.userId
                        ? "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50"
                        : "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900/50"
                    )}>
                      {row.userId ? "User" : "Role"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {new Date(row.grantedAt).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => revoke(row.id)}
                      disabled={revoking === row.id}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 rounded-md hover:bg-destructive/10"
                    >
                      {revoking === row.id
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <Trash2 className="size-3.5" />
                      }
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add access */}
      <div className="flex flex-wrap items-center gap-2">
        {addMode ? (
          <div className="flex flex-wrap items-center gap-2 w-full">
            <select
              className={`${selectCls} flex-1 min-w-48`}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Select {addMode}…</option>
              {addMode === "user"
                ? users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))
                : roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))
              }
            </select>
            <Button size="sm" onClick={grant} disabled={!selectedId || saving} className="gap-1.5">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Grant Access
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setAddMode(null); setSelectedId(""); }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddMode("user")}
              className="gap-1.5"
            >
              <UserPlus className="size-3.5" />
              Add User
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddMode("role")}
              className="gap-1.5"
            >
              <Shield className="size-3.5" />
              Add Role
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
