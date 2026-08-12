import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
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
