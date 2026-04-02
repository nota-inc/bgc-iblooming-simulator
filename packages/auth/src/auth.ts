import Credentials from "next-auth/providers/credentials";
import NextAuth from "next-auth";

import { getUserByEmail, mapUserRoles, recordUserLogin, writeAuditEvent } from "@bgc-alpha/db";

import {
  appCapabilities,
  appRoles,
  getCapabilitiesForRoles,
  type AppCapability,
  type AppRole
} from "./roles";
import { verifyPassword } from "./passwords";

type AuthClaims = {
  roles?: AppRole[];
  capabilities?: AppCapability[];
  status?: "ACTIVE" | "INACTIVE";
};

const authHandlers = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/sign-in"
  },
  providers: [
    Credentials({
      name: "Internal credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email"
        },
        password: {
          label: "Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        const user = await getUserByEmail(email);

        if (!user || user.status !== "ACTIVE") {
          return null;
        }

        if (!verifyPassword(password, user.passwordHash)) {
          return null;
        }

        const roles = mapUserRoles(user).filter(isAppRole);
        const capabilities = getCapabilitiesForRoles(roles);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          roles,
          capabilities
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const claims = user as typeof user & AuthClaims;

        token.userId = user.id;
        token.roles = claims.roles ?? [];
        token.capabilities = claims.capabilities ?? [];
        token.status = claims.status ?? "ACTIVE";
      }

      return token;
    },
    session({ session, token }) {
      if (!session.user || !token.userId) {
        return session;
      }

      const sessionUser = session.user as typeof session.user & {
        id: string;
        roles: AppRole[];
        capabilities: AppCapability[];
        status: "ACTIVE" | "INACTIVE";
      };

      sessionUser.id = String(token.userId);
      sessionUser.roles = Array.isArray(token.roles)
        ? token.roles.filter((value): value is AppRole => typeof value === "string" && isAppRole(value))
        : [];
      sessionUser.capabilities = Array.isArray(token.capabilities)
        ? token.capabilities.filter(
            (value): value is AppCapability => typeof value === "string" && isAppCapability(value)
          )
        : [];
      sessionUser.status = token.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

      return session;
    }
  },
  events: {
    async signIn(event) {
      const userId = event.user.id;

      if (!userId) {
        return;
      }

      await Promise.allSettled([
        recordUserLogin(userId),
        writeAuditEvent({
          actorUserId: userId,
          entityType: "auth_session",
          entityId: userId,
          action: "user.sign_in",
          metadata: {
            provider: event.account?.provider ?? "credentials"
          }
        })
      ]);
    }
  }
});

function isAppRole(value: string): value is AppRole {
  return (appRoles as readonly string[]).includes(value);
}

function isAppCapability(value: string): value is AppCapability {
  return (appCapabilities as readonly string[]).includes(value);
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut
} = authHandlers;
