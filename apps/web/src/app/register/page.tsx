import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  title: "Create your space",
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("NEXT_REDIRECT")) throw error;
      void 0;
    }
  }
  const registrationEnabled =
    process.env["NEXT_PUBLIC_REGISTRATION_ENABLED"] === "true";

  return (
    <AuthShell
      description="Start a private place for the two of you."
      eyebrow="A place for two"
      title="Create your Mugful space"
    >
      {registrationEnabled ? (
        <IdentityForm mode="register" />
      ) : (
        <p>
          Registration is invite-only right now. Ask your partner for an invite
          when your shared space is ready.
        </p>
      )}
    </AuthShell>
  );
}
