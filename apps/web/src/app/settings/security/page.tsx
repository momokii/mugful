import type { Metadata } from "next";

import { AccountSecurity } from "../../../components/account-security";
import { AuthShell } from "../../../components/auth-shell";
import { IdentityForm } from "../../../components/identity-form";

export const metadata: Metadata = { title: "Account security" };

export default function AccountSecurityPage() {
  return (
    <AuthShell
      description="Change your password and remove sessions you do not recognize."
      eyebrow="Account security"
      title="Keep your account safe"
    >
      <IdentityForm mode="password" />
      <AccountSecurity />
    </AuthShell>
  );
}
