import { db } from "./index";
import { users, userRoles, roles } from "./schema";
import { eq } from "drizzle-orm";

export async function upsertUser(profile: { email: string; name?: string | null; image?: string | null }) {
  const email = profile.email.toLowerCase().trim();
  const [user] = await db
    .insert(users)
    .values({
      email,
      name:      profile.name ?? null,
      image:     profile.image ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name:      profile.name ?? null,
        image:     profile.image ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Assign default "member" role if user has no roles yet
  const existing = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  if (existing.length === 0) {
    const [memberRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "member"));

    if (memberRole) {
      await db.insert(userRoles).values({ userId: user.id, roleId: memberRole.id }).onConflictDoNothing();
    }
  }

  return user;
}

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  return user ?? null;
}
