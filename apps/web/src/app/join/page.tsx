import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { CoupleOnboarding } from "../../components/couple-onboarding";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Join your shared space",
};

export default function JoinPage() {
  return (
    <AuthShell
      description="Accept a private invitation after signing in to your own account."
      eyebrow="Private invitation"
      title="Join a shared space"
    >
      <CoupleOnboarding mode="join" />
    </AuthShell>
  );
}
