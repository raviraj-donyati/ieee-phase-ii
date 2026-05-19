"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Chatbot } from "@/types";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { fetchKAList, fetchGenieSpaces, fetchSupervisorEndpoints } from "@/lib/api";

const AGENT_TYPES = [
  { value: "ka",         label: "Knowledge Assistant", description: "Query internal knowledge bases" },
  { value: "genie",      label: "Genie Space",         description: "Natural language SQL on Databricks" },
  { value: "supervisor", label: "Supervisor Agent",    description: "Multi-step AI task delegation" },
];

interface AgentOption { value: string; label: string; sub?: string }

async function loadAgentOptions(agentType: string): Promise<AgentOption[]> {
  if (agentType === "ka") {
    const list = await fetchKAList();
    return list.map((k) => ({ value: k.endpoint_name, label: k.display_name, sub: k.description }));
  }
  if (agentType === "genie") {
    const list = await fetchGenieSpaces();
    return list.map((g) => ({ value: g.space_id, label: g.title }));
  }
  const list = await fetchSupervisorEndpoints();
  return list.map((e) => ({ value: e.name, label: e.display_name, sub: e.description }));
}

interface ChatbotFormProps {
  chatbot?: Chatbot;
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";
const hintCls  = "text-xs text-muted-foreground mt-1";

export default function ChatbotForm({ chatbot }: ChatbotFormProps) {
  const router = useRouter();
  const isEdit = !!chatbot;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: chatbot?.name ?? "",
    description: chatbot?.description ?? "",
    slug: chatbot?.slug ?? "",
    agentType: chatbot?.agentType ?? "ka",
    agentId: chatbot?.agentId ?? "",
    logoUrl: chatbot?.logoUrl ?? "",
    isActive: chatbot?.isActive ?? true,
  });

  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchOptions = async (agentType: string) => {
    setLoadingOptions(true);
    setLoadError(null);
    try {
      const opts = await loadAgentOptions(agentType);
      setAgentOptions(opts);
      setForm((prev) => ({
        ...prev,
        agentId: opts.find((o) => o.value === prev.agentId) ? prev.agentId : (opts[0]?.value ?? ""),
      }));
    } catch {
      setLoadError("Failed to load endpoints");
      setAgentOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => { fetchOptions(form.agentType); }, [form.agentType]);

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/chatbots/${chatbot.id}` : "/api/admin/chatbots";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save");
      }
      router.push("/admin/chatbots");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const selectedOption = agentOptions.find((o) => o.value === form.agentId);
  const selectedAgentType = AGENT_TYPES.find((t) => t.value === form.agentType);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Basic info */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Name <span className="text-destructive">*</span>
            </label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!isEdit) set("slug", autoSlug(e.target.value));
              }}
              placeholder="My Chatbot"
              required
            />
          </div>
          <div>
            <label className={labelCls}>
              Slug <span className="text-destructive">*</span>
              <span className="text-muted-foreground font-normal ml-1 text-xs">(URL identifier)</span>
            </label>
            <input
              className={inputCls}
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="my-chatbot"
              required
            />
            {form.slug && (
              <p className={hintCls}>
                URL: <code className="font-mono text-primary">/c/{form.slug}</code>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            className={`${inputCls} min-h-[80px] resize-none`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What does this chatbot do?"
          />
        </div>

        <div>
          <label className={labelCls}>
            Logo URL <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </label>
          <input
            className={inputCls}
            value={form.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Agent configuration */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Agent Configuration</h3>

        {/* Agent type selector */}
        <div>
          <label className={labelCls}>Agent Type <span className="text-destructive">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {AGENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("agentType", t.value)}
                className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-all ${
                  form.agentType === t.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{t.label}</span>
                <span className="text-xs text-muted-foreground leading-snug">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Agent endpoint */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={`${labelCls} mb-0`}>
              {form.agentType === "ka" ? "Knowledge Assistant" : form.agentType === "genie" ? "Genie Space" : "Supervisor Endpoint"}
              <span className="text-destructive ml-1">*</span>
            </label>
            <button
              type="button"
              onClick={() => fetchOptions(form.agentType)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh list"
            >
              <RefreshCw className={`size-3 ${loadingOptions ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loadingOptions ? (
            <div className={`${inputCls} flex items-center gap-2 text-muted-foreground/60`}>
              <Loader2 className="size-4 animate-spin" />
              <span>Loading endpoints…</span>
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {loadError} —{" "}
              <button type="button" onClick={() => fetchOptions(form.agentType)} className="underline font-medium">
                retry
              </button>
            </div>
          ) : agentOptions.length === 0 ? (
            <div className={`${inputCls} text-muted-foreground/50`}>No endpoints found</div>
          ) : (
            <select
              className={`${inputCls} cursor-pointer`}
              value={form.agentId}
              onChange={(e) => set("agentId", e.target.value)}
              required
            >
              <option value="" disabled>Select…</option>
              {agentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}

          {selectedOption?.sub && (
            <div className="flex items-start gap-1.5 mt-2">
              <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-snug">{selectedOption.sub}</p>
            </div>
          )}
          {form.agentId && (
            <p className={hintCls}>
              ID: <code className="font-mono">{form.agentId}</code>
            </p>
          )}
        </div>
      </div>

      {/* Visibility */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Visibility</h3>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full border-2 border-border bg-muted peer-checked:bg-primary peer-checked:border-primary transition-all" />
            <div className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-all peer-checked:translate-x-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When active, this chatbot is visible to users with access.
            </p>
          </div>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={saving || loadingOptions} className="gap-2 px-5">
          {saving
            ? <Loader2 className="size-4 animate-spin" />
            : <CheckCircle2 className="size-4" />
          }
          {isEdit ? "Save Changes" : "Create Chatbot"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
