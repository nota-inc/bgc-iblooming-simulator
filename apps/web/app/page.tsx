import { redirect } from "next/navigation";

import { auth } from "@bgc-alpha/auth";

export default async function HomePage() {
  const session = await auth();

  redirect(session?.user ? "/overview" : "/sign-in");
}
