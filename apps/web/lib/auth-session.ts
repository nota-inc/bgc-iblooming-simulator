import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { auth } from "@bgc-alpha/auth";
import { hasAnyCapability } from "@bgc-alpha/auth/guards";
import type { AppCapability, AppRole } from "@bgc-alpha/auth/roles";

export type AppSessionUser = {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  capabilities: AppCapability[];
  status: "ACTIVE" | "INACTIVE";
};

export function getSessionUser(session: Session | null): AppSessionUser | null {
  const sessionUser = session?.user as
    | (Session["user"] & {
        id?: string;
        roles?: AppRole[];
        capabilities?: AppCapability[];
        status?: "ACTIVE" | "INACTIVE";
      })
    | undefined;

  if (!sessionUser?.id || !sessionUser.email || !sessionUser.name) {
    return null;
  }

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    roles: sessionUser.roles ?? [],
    capabilities: sessionUser.capabilities ?? [],
    status: sessionUser.status ?? "ACTIVE"
  };
}

export async function requirePageUser(expectedCapabilities: AppCapability[] = []) {
  const session = await auth();
  const user = getSessionUser(session);

  if (!user) {
    redirect("/sign-in");
  }

  if (
    expectedCapabilities.length > 0 &&
    !hasAnyCapability(user.capabilities, expectedCapabilities)
  ) {
    redirect("/overview?error=forbidden");
  }

  return user;
}

export async function authorizeApiRequest(expectedCapabilities: AppCapability[] = []) {
  const session = await auth();
  const user = getSessionUser(session);

  if (!user) {
    return {
      response: NextResponse.json(
        {
          error: "unauthorized"
        },
        {
          status: 401
        }
      )
    };
  }

  if (
    expectedCapabilities.length > 0 &&
    !hasAnyCapability(user.capabilities, expectedCapabilities)
  ) {
    return {
      response: NextResponse.json(
        {
          error: "forbidden"
        },
        {
          status: 403
        }
      )
    };
  }

  return {
    user
  };
}
