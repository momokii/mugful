import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="We will send a private reset link if this address has an account."
      eyebrow="Account access"
      title="Reset your password"
    >
      <IdentityForm mode="forgot" />
    </AuthShell>
  );
}
