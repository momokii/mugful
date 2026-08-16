import Link from "next/link";

import styles from "./auth-shell.module.css";

export function ConsentAffirmations() {
  return (
    <fieldset className={styles.consent}>
      <legend>Persetujuan pendaftaran</legend>
      <label className={styles.checkbox}>
        <input name="adult" required type="checkbox" /> Saya menyatakan bahwa
        saya berusia minimal 18 tahun.
      </label>
      <label className={styles.checkbox}>
        <input name="terms" required type="checkbox" /> Saya menyetujui Syarat
        dan Ketentuan versi terms-v1.
      </label>
      <p className={styles.legalLink}>
        <Link href="/legal/terms">Baca Syarat dan Ketentuan</Link>
      </p>
      <label className={styles.checkbox}>
        <input name="privacy" required type="checkbox" /> Saya telah membaca dan
        menyetujui Pemberitahuan Privasi versi privacy-v1.
      </label>
      <p className={styles.legalLink}>
        <Link href="/legal/privacy">Baca Pemberitahuan Privasi</Link>
      </p>
    </fieldset>
  );
}
