import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { IdentityForm } from "../../components/identity-form";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Choose a new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      description="Choose a new password to finish recovering your account."
      eyebrow="Account access"
      title="Choose a fresh password"
    >
      <IdentityForm mode="reset" />
    </AuthShell>
  );
}
