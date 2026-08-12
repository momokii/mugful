import type { Metadata } from "next";

import { AuthShell } from "../../components/auth-shell";
import { PrivacyCenter } from "../../components/privacy-center";

export const metadata: Metadata = { title: "Pusat Privasi" };

export default function PrivacyPage() {
  return (
    <AuthShell
      description="Lihat persetujuan dan status keamanan akun Anda."
      eyebrow="Privasi"
      title="Pusat Privasi"
    >
      <PrivacyCenter />
    </AuthShell>
  );
}
