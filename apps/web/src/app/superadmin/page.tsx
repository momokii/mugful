import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { SuperadminConsole } from "../../components/superadmin-console";

export const metadata: Metadata = { title: "Prompt tooling" };

export default function SuperadminPage() {
  return (
    <AuthShell
      description="Operational prompt catalog management. This console is not linked from the product."
      eyebrow="Operations"
      title="Prompt tooling"
    >
      <SuperadminConsole />
    </AuthShell>
  );
}
