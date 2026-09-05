import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader.length > 0) {
    try {
      const apiOrigin =
        process.env["API_INTERNAL_ORIGIN"] ?? "http://127.0.0.1:3001";
      const response = await fetch(`${apiOrigin}/v1/auth/session`, {
        cache: "no-store",
        headers: { cookie: cookieHeader },
      });
      if (response.ok) redirect("/home");
    } catch {
      void 0;
    }
  }
  return (
    <AuthShell
      description="Come back to the quiet place you share."
      eyebrow="Welcome back"
      title="Sign in to Mugful"
    >
      <IdentityForm mode="login" />
    </AuthShell>
  );
}
