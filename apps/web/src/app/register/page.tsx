import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  title: "Create your space",
};

export default function RegisterPage() {
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
