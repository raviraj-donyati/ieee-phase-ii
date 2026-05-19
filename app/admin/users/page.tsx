import { db } from "@/lib/db";
import { users, userRoles, roles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import UsersTable from "@/components/admin/UsersTable";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function AdminUsersPage() {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const allRoles = await db.select().from(roles);

  const usersWithRoles = await Promise.all(
    allUsers.map(async (u) => {
      const roleRows = await db
        .select({ id: roles.id, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id));
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        roles: roleRows,
      };
    })
  );

  const activeCount = usersWithRoles.filter((u) => u.isActive).length;

  return (
    <>
      <AdminPageHeader
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link href="/admin">Admin</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Users</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />

      <div className="p-6 sm:p-8 w-full page-enter">
        <div className="mb-6">
          <p className="text-muted-foreground text-sm">
            {usersWithRoles.length} registered account{usersWithRoles.length !== 1 ? "s" : ""}
            {activeCount > 0 && ` · ${activeCount} active`}
          </p>
        </div>
        <UsersTable users={usersWithRoles} allRoles={allRoles} />
      </div>
    </>
  );
}
