import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, userRoles, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

  if (!roleRows.some((r) => r.name === "admin")) redirect("/dashboard");

  return (
    <AdminShell user={{ name: user.name, email: user.email }}>
      {children}
    </AdminShell>
  );
}
