import type { Metadata } from "next";

import { AuthShell } from "../../../components/auth-shell";

export const metadata: Metadata = { title: "Pemberitahuan Privasi" };

export default function PrivacyNoticePage() {
  return (
    <AuthShell
      description="Versi privacy-v1 adalah versi Pemberitahuan Privasi saat ini untuk pendaftaran akun Mugful."
      eyebrow="Hukum"
      title="Pemberitahuan Privasi"
    >
      <p className="legal-copy">
        Mugful memproses alamat email, nama tampilan, persetujuan berversi, dan
        data sesi untuk menyediakan serta mengamankan akun Anda. Pemberitahuan
        ini adalah Bahasa Indonesia sebagai bahasa utama. Setelah Anda
        memberikan persetujuan, server Mugful mencatat persetujuan tersebut
        sebagai privacy-v1.
      </p>
    </AuthShell>
  );
}
