import { db } from "./index";
import { users, userRoles, endpointPermissions, userEndpointPermissions } from "./schema";
import { eq, and } from "drizzle-orm";

/**
 * Check if a user can access a given endpoint.
 * Resolution order:
 *  1. User-level explicit DENY  → false
 *  2. User-level explicit GRANT → true
 *  3. Endpoint marked is_public → true
 *  4. User has a role that is granted access → true
 *  5. Default → false
 */
export async function canUserAccessEndpoint(
  email: string,
  toolType: string,
  endpointId: string
): Promise<boolean> {
  // Get user
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.isActive) return false;

  // 1 & 2 — user-level override
  const [userOverride] = await db
    .select()
    .from(userEndpointPermissions)
    .where(
      and(
        eq(userEndpointPermissions.userId, user.id),
        eq(userEndpointPermissions.toolType, toolType),
        eq(userEndpointPermissions.endpointId, endpointId)
      )
    );

  if (userOverride) return userOverride.granted;

  // 3 — public endpoint
  const [publicPerm] = await db
    .select()
    .from(endpointPermissions)
    .where(
      and(
        eq(endpointPermissions.toolType, toolType),
        eq(endpointPermissions.endpointId, endpointId),
        eq(endpointPermissions.isPublic, true)
      )
    );

  if (publicPerm) return true;

  // 4 — role-based access
  const userRoleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  const roleIds = userRoleRows.map((r) => r.roleId);
  if (roleIds.length === 0) return false;

  const rolePerms = await db
    .select()
    .from(endpointPermissions)
    .where(
      and(
        eq(endpointPermissions.toolType, toolType),
        eq(endpointPermissions.endpointId, endpointId)
      )
    );

  return rolePerms.some((p) => p.roleId && roleIds.includes(p.roleId));
}

/**
 * Get all endpoint IDs a user can access for a given tool type.
 * Useful for filtering the sidebar list.
 */
export async function getAllowedEndpoints(
  email: string,
  toolType: string,
  allEndpointIds: string[]
): Promise<string[]> {
  const results = await Promise.all(
    allEndpointIds.map(async (id) => {
      const allowed = await canUserAccessEndpoint(email, toolType, id);
      return allowed ? id : null;
    })
  );
  return results.filter(Boolean) as string[];
}

/**
 * Get full user profile with roles.
 */
export async function getUserWithRoles(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return null;

  const roleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  return { ...user, roleIds: roleRows.map((r) => r.roleId) };
}
