import type { DefaultSession } from "next-auth";

import type { AppCapability, AppRole } from "./roles";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: AppRole[];
      capabilities: AppCapability[];
      status: "ACTIVE" | "INACTIVE";
    };
  }

  interface User {
    id: string;
    roles: AppRole[];
    capabilities: AppCapability[];
    status: "ACTIVE" | "INACTIVE";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    roles?: AppRole[];
    capabilities?: AppCapability[];
    status?: "ACTIVE" | "INACTIVE";
  }
}
