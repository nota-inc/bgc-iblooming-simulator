"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { signIn } from "next-auth/react";

const defaultCredentials = {
  email: "",
  password: ""
};

export function SignInForm() {
  const router = useRouter();
  const [credentials, setCredentials] = useState(defaultCredentials);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="stack-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        startTransition(async () => {
          const result = await signIn("credentials", {
            ...credentials,
            redirect: false
          });

          if (!result || result.error) {
            setError("Email or password is not valid for an active internal user.");
            return;
          }

          router.replace("/overview");
          router.refresh();
        });
      }}
    >
      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => {
            setCredentials((current) => ({
              ...current,
              email: event.target.value
            }));
          }}
          placeholder="founder@bgc.local"
          required
          type="email"
          value={credentials.email}
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => {
            setCredentials((current) => ({
              ...current,
              password: event.target.value
            }));
          }}
          placeholder="ChangeMe123!"
          required
          type="password"
          value={credentials.password}
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
