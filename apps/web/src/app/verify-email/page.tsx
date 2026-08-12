import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Verify your email",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      description="Confirm your email, or request another private verification link."
      eyebrow="Email confirmation"
      title="Verify your email"
    >
      <IdentityForm mode="verify" />
    </AuthShell>
  );
}
