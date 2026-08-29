import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { GuessMyAnswer } from "../../components/guess-my-answer";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <AuthShell
      description="Your private space for two. Start a round whenever it suits you."
      eyebrow="Together"
      title="Welcome home"
    >
      <GuessMyAnswer />
    </AuthShell>
  );
}
