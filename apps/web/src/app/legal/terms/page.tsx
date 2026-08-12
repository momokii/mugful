import type { Metadata } from "next";

import { AuthShell } from "../../../components/auth-shell";

export const metadata: Metadata = { title: "Syarat dan Ketentuan" };

export default function TermsPage() {
  return (
    <AuthShell
      description="Versi terms-v1 berlaku untuk pendaftaran akun Mugful."
      eyebrow="Hukum"
      title="Syarat dan Ketentuan"
    >
      <p className="legal-copy">
        Mugful adalah ruang privat untuk pasangan dewasa. Dengan membuat akun,
        Anda menyetujui penggunaan layanan sesuai tujuan produk dan ketentuan
        yang berlaku.
      </p>
    </AuthShell>
  );
}
