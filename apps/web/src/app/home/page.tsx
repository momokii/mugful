import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { GuessMyAnswer } from "../../components/guess-my-answer";
import { TogetherRoom } from "../../components/together-room";
import { requireSession } from "../../lib/require-session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  await requireSession();
  return (
    <AuthShell
      description="Your private space for two. Start a round or see each other whenever it suits you."
      eyebrow="Together"
      title="Welcome home"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <TogetherRoom />
        <GuessMyAnswer />
      </div>
    </AuthShell>
  );
}
