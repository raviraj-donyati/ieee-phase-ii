/**
 * Databricks Permissions API helpers.
 *
 * Used to check whether a logged-in user has CAN_QUERY or CAN_MANAGE
 * on a serving endpoint — so we can filter chatbots without maintaining
 * a separate user→chatbot mapping in our own DB.
 */

import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

type PermissionLevel = "CAN_VIEW" | "CAN_QUERY" | "CAN_MANAGE" | "NO_PERMISSIONS";

interface AccessControlItem {
  user_name?: string;
  group_name?: string;
  service_principal_name?: string;
  all_permissions?: { permission_level: PermissionLevel; inherited: boolean }[];
}

interface PermissionsResponse {
  access_control_list?: AccessControlItem[];
}

/**
 * Resolve a serving endpoint name to its numeric ID.
 * The Permissions API requires the numeric ID, not the name.
 * Returns null if the endpoint can't be found.
 */
async function getEndpointNumericId(endpointName: string): Promise<string | null> {
  try {
    const res = await databricksFetch(
      `${HOST}/api/2.0/serving-endpoints/${encodeURIComponent(endpointName)}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        cache: "no-store",
        timeoutMs: 6_000,
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const id = data.id ?? null;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch the ACL for a serving endpoint by its numeric ID.
 * Returns null if the request fails.
 */
async function getEndpointPermissions(endpointId: string): Promise<PermissionsResponse | null> {
  try {
    const res = await databricksFetch(
      `${HOST}/api/2.0/permissions/serving-endpoints/${encodeURIComponent(endpointId)}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        cache: "no-store",
        timeoutMs: 6_000,
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch the Databricks user record for an email via the SCIM API.
 * Returns the user's groups so we can do group-level permission checks.
 */
async function getDatabricksUserGroups(email: string): Promise<string[]> {
  try {
    const res = await databricksFetch(
      `${HOST}/api/2.0/preview/scim/v2/Users?filter=userName+eq+%22${encodeURIComponent(email)}%22&attributes=groups`,
      {
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        cache: "no-store",
        timeoutMs: 6_000,
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const user = data.Resources?.[0];
    if (!user) return [];
    return (user.groups ?? []).map((g: { display?: string }) => g.display ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Filter a list of endpoint names to only those the user can query.
 * Fetches SCIM groups once and reuses across all endpoint checks.
 * Runs all permission checks in parallel for performance.
 *
 * Set DATABRICKS_IGNORE_GROUPS=true to skip group-based grants —
 * only direct per-user grants (CAN_QUERY or CAN_MANAGE) will count.
 */
export async function filterAccessibleEndpoints(
  userEmail: string,
  endpointNames: string[]
): Promise<string[]> {
  if (endpointNames.length === 0) return [];

  const ignoreGroups = process.env.DATABRICKS_IGNORE_GROUPS === "true";

  // Fetch user groups once + resolve all endpoint IDs in parallel
  const [userGroups, ...endpointIds] = await Promise.all([
    getDatabricksUserGroups(userEmail),
    ...endpointNames.map((name) => getEndpointNumericId(name)),
  ]);

  // Check permissions for all resolved endpoints in parallel
  const permissionResults = await Promise.all(
    endpointNames.map(async (name, i) => {
      const id = endpointIds[i];
      if (!id) return { name, allowed: false };

      const permissions = await getEndpointPermissions(id);
      if (!permissions?.access_control_list) return { name, allowed: false };

      const allowedLevels: PermissionLevel[] = ["CAN_QUERY", "CAN_MANAGE"];
      for (const acl of permissions.access_control_list) {
        const levels = acl.all_permissions?.map((p) => p.permission_level) ?? [];
        if (!levels.some((l) => allowedLevels.includes(l))) continue;

        if (acl.user_name?.toLowerCase() === userEmail.toLowerCase()) {
          return { name, allowed: true };
        }
        if (!ignoreGroups && acl.group_name && (userGroups as string[]).includes(acl.group_name)) {
          return { name, allowed: true };
        }
      }
      return { name, allowed: false };
    })
  );

  return permissionResults.filter((r) => r.allowed).map((r) => r.name);
}
