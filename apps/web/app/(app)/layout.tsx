import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth-session";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();

  return <AppShell user={user}>{children}</AppShell>;
}
