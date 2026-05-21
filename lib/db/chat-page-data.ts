import { db } from "./index";
import { users, userRoles, roles } from "./schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { filterAccessibleEndpoints } from "@/lib/databricks-permissions";
import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

export type SerializedChatbot = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  agentType: "ka" | "genie" | "supervisor";
  agentId: string;
  logoUrl: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatPageData = {
  chatbots: SerializedChatbot[];
  isAdmin: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tagValue(tags: { key: string; value: string }[], key: string): string | null {
  return tags.find((t) => t.key === key)?.value ?? null;
}

/**
 * Infer agent type from endpoint name prefix, with tag override.
 *   1. agent_type tag — "ka" | "supervisor"
 *   2. Name prefix: "ka-" → ka, "mas-" → supervisor
 *   3. null → endpoint is ignored
 */
function inferAgentType(
  endpointName: string,
  tags: { key: string; value: string }[]
): "ka" | "supervisor" | null {
  const tagType = tagValue(tags, "agent_type");
  if (tagType === "ka" || tagType === "supervisor") return tagType;
  if (endpointName.startsWith("ka-")) return "ka";
  if (endpointName.startsWith("mas-")) return "supervisor";
  return null;
}

/**
 * Fetch serving endpoints from Databricks.
 * Only endpoints with a display_name tag are included.
 * Agent type is inferred from name prefix or agent_type tag.
 */
async function fetchServingEndpointChatbots(): Promise<SerializedChatbot[]> {
  try {
    const res = await databricksFetch(`${HOST}/api/2.0/serving-endpoints`, {
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      timeoutMs: 8_000,
    });
    if (!res.ok) return [];

    const data = await res.json();
    const now = new Date().toISOString();

    return (data.endpoints ?? [])
      .filter((e: { name: string; tags?: { key: string; value: string }[] }) =>
        inferAgentType(e.name, e.tags ?? []) !== null
      )
      .map((e: {
        name: string;
        tags?: { key: string; value: string }[];
        creation_timestamp?: number;
        last_updated_timestamp?: number;
      }) => {
        const tags = e.tags ?? [];
        const agentType = inferAgentType(e.name, tags)!;
        const displayName = tagValue(tags, "display_name");
        if (!displayName) return null;

        return {
          id:          e.name,
          name:        displayName,
          description: tagValue(tags, "description"),
          slug:        e.name,
          agentType,
          agentId:     e.name,
          logoUrl:     tagValue(tags, "logo_url"),
          isActive:    true,
          createdBy:   null,
          createdAt:   e.creation_timestamp ? new Date(e.creation_timestamp).toISOString() : now,
          updatedAt:   e.last_updated_timestamp ? new Date(e.last_updated_timestamp).toISOString() : now,
        } satisfies SerializedChatbot;
      })
      .filter((e: SerializedChatbot | null): e is SerializedChatbot => e !== null);
  } catch {
    return [];
  }
}

/**
 * Fetch Genie spaces from Databricks.
 * Controlled by ENABLE_GENIE=true env var.
 */
async function fetchGenieChatbots(): Promise<SerializedChatbot[]> {
  try {
    const res = await databricksFetch(`${HOST}/api/2.0/genie/spaces`, {
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      timeoutMs: 8_000,
    });
    if (!res.ok) return [];

    const data = await res.json();
    const now = new Date().toISOString();

    return (data.spaces ?? []).map((s: {
      space_id: string;
      title: string;
      description?: string;
    }) => ({
      id:          s.space_id,
      name:        s.title,
      description: s.description ?? null,
      slug:        s.space_id,
      agentType:   "genie" as const,
      agentId:     s.space_id,
      logoUrl:     null,
      isActive:    true,
      createdBy:   null,
      createdAt:   now,
      updatedAt:   now,
    } satisfies SerializedChatbot));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Shared data fetch for /chat and /chat/[chatId] pages.
 *
 * Chatbots are auto-discovered from Databricks — no app-level registration needed.
 * Serving endpoints require a display_name tag and CAN_QUERY/CAN_MANAGE permission.
 * Genie spaces are opt-in via ENABLE_GENIE=true.
 */
export async function getUserChatbots(): Promise<ChatPageData> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const email = session.user.email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) redirect("/login");

  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const isAdmin = roleRows.some((r) => r.name === "admin");

  const enableGenie = process.env.ENABLE_GENIE === "true";

  const [endpointChatbots, genieChatbots] = await Promise.all([
    fetchServingEndpointChatbots(),
    enableGenie ? fetchGenieChatbots() : Promise.resolve([]),
  ]);

  const endpointNames = endpointChatbots.map((b) => b.agentId);
  const accessibleNames = new Set(await filterAccessibleEndpoints(email, endpointNames));

  const accessible = [
    ...endpointChatbots.filter((b) => accessibleNames.has(b.agentId)),
    ...genieChatbots,
  ];

  return { isAdmin, chatbots: accessible };
}
