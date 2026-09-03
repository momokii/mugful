import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { GuessMyAnswer } from "../../components/guess-my-answer";
import { TogetherRoom } from "../../components/together-room";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <AuthShell
      description="Your private space for two. Start a round or see each other whenever it suits you."
      eyebrow="Together"
      title="Welcome home"
    >
      <TogetherRoom />
      <GuessMyAnswer />
    </AuthShell>
  );
}
