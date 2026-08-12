import type { Metadata } from "next";

import { AuthShell } from "../../../components/auth-shell";

export const metadata: Metadata = { title: "Pemberitahuan Privasi" };

export default function PrivacyNoticePage() {
  return (
    <AuthShell
      description="Versi privacy-v1 berlaku untuk pendaftaran akun Mugful."
      eyebrow="Hukum"
      title="Pemberitahuan Privasi"
    >
      <p className="legal-copy">
        Mugful memproses alamat email, nama tampilan, persetujuan berversi, dan
        data sesi untuk menyediakan serta mengamankan akun Anda. Pemberitahuan
        ini adalah Bahasa Indonesia sebagai bahasa utama.
      </p>
    </AuthShell>
  );
}
