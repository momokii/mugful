import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  title: "Create your space",
};

export default function RegisterPage() {
  return (
    <AuthShell
      description="Start a private place for the two of you."
      eyebrow="A place for two"
      title="Create your Mugful space"
    >
      <IdentityForm mode="register" />
    </AuthShell>
  );
}
