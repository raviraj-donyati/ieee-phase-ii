import NextAuth, { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { upsertUser } from "@/lib/db/users";
import { db } from "@/lib/db";
import { users, userRoles, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;


        const normalizedEmail = credentials.email.toLowerCase().trim();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail));

        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Only upsert for OAuth — credentials users are already in DB
      if (account?.provider !== "credentials") {
        await upsertUser({ email: user.email.toLowerCase().trim(), name: user.name, image: user.image });
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // If the URL is already an absolute URL on this origin, honour it —
      // but only if it's NOT the generic /chat or / fallback from the login page.
      const genericFallbacks = ["/playground", "/", `${baseUrl}/playground`, `${baseUrl}/`];
      if (!genericFallbacks.includes(url) && url.startsWith(baseUrl)) {
        return url;
      }

      // For all other cases (fresh login, generic fallback) route by role.
      // We can't access the session here yet, so we re-derive role from the
      // token email that NextAuth passes via the URL's `callbackUrl` param.
      // Instead, we return a special route that does the server-side redirect.
      return `${baseUrl}/api/auth/role-redirect`;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.email =
          (profile as { email?: string; preferred_username?: string }).email ??
          (profile as { preferred_username?: string }).preferred_username ??
          token.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
