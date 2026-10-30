import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/server/db";
import { loginSchema } from "@/lib/validation/auth";

// Hash of a random string. Comparing against it when the email is unknown keeps
// response times equal, so attackers cannot probe which emails exist.
const DUMMY_HASH = "$2b$12$IcASP4GdaVPjyvDGI6RUY.T8BHy/0KtMW86b.VaVV0WlcyF0s.DPO";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, passwordHash: true },
        });

        const valid = await compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        // Never return the password hash: whatever we return here ends up in the JWT.
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    // The token only carries the user id. Role and company are loaded from the
    // database on each request (see server/session.ts), so permission changes
    // take effect immediately instead of waiting for the JWT to expire.
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
