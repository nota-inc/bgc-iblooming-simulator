import { auth } from "@bgc-alpha/auth";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/overview");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div style={{ marginBottom: "1rem" }}>
          <span className="badge badge--accent">Internal Access</span>
        </div>

        <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          BGC Alpha Simulator
        </h2>
        <p className="muted" style={{ marginBottom: "1.5rem", fontSize: "0.88rem" }}>
          Internal decision console for ALPHA policy simulation
        </p>

        <p style={{ margin: "0 0 0.15rem", fontSize: "0.82rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          Email Address
        </p>

        <SignInForm />

        <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.75rem", textAlign: "center" }}>
          This tool is restricted to approved internal users only.
        </p>
      </section>
    </main>
  );
}
