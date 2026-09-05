import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { CoupleOnboarding } from "../../components/couple-onboarding";
import { requireSession } from "../../lib/require-session";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Create your shared space",
};

export default async function OnboardingPage() {
  await requireSession();
  return (
    <AuthShell
      description="Invite your partner with one private, copyable link."
      eyebrow="Your shared space"
      title="Create a space"
    >
      <CoupleOnboarding mode="create" />
    </AuthShell>
  );
}
