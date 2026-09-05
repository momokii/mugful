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
      <nav
        aria-label="Superadmin sections"
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "0.75rem",
        }}
      >
        <span
          aria-current="page"
          style={{ fontWeight: 700, borderBottom: "2px solid var(--text-primary)", paddingBottom: "0.25rem" }}
        >
          Prompts
        </span>
        <span style={{ color: "var(--text-secondary)" }}>Users — coming soon</span>
        <span style={{ color: "var(--text-secondary)" }}>Audits — coming soon</span>
      </nav>
      <SuperadminConsole />
    </AuthShell>
  );
}
