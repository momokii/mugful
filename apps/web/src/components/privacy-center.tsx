"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./auth-shell.module.css";

type Consent = Readonly<{
  grantedAt: string;
  kind: "privacy" | "terms";
  version: string;
}>;

type PrivacyState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "error" }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{
      consents: readonly Consent[];
      emailVerified: boolean;
      kind: "ready";
    }>;

export function PrivacyCenter() {
  const [state, setState] = useState<PrivacyState>({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/auth/privacy", {
          credentials: "same-origin",
        });
        if (response.status === 401) {
          setState({ kind: "unauthenticated" });
          return;
        }
        const body: unknown = await response.json();
        if (
          !response.ok ||
          typeof body !== "object" ||
          body === null ||
          !("consents" in body) ||
          !Array.isArray(body.consents) ||
          !("emailVerified" in body) ||
          typeof body.emailVerified !== "boolean"
        ) {
          setState({ kind: "error" });
          return;
        }
        const consents = body.consents.flatMap((consent) =>
          typeof consent === "object" &&
          consent !== null &&
          "grantedAt" in consent &&
          "kind" in consent &&
          "version" in consent &&
          typeof consent.grantedAt === "string" &&
          (consent.kind === "privacy" || consent.kind === "terms") &&
          typeof consent.version === "string"
            ? [
                {
                  grantedAt: consent.grantedAt,
                  kind: consent.kind,
                  version: consent.version,
                },
              ]
            : [],
        );
        setState({
          consents,
          emailVerified: body.emailVerified,
          kind: "ready",
        });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        setState({ kind: "error" });
      }
    })();
  }, []);

  if (state.kind === "loading")
    return <p className={styles.hint}>Memuat informasi privasi Anda.</p>;
  if (state.kind === "unauthenticated")
    return (
      <p className={styles.hint}>
        Silakan <Link href="/login">masuk</Link> untuk melihat informasi privasi
        Anda.
      </p>
    );
  if (state.kind === "error")
    return (
      <p className={styles.hint} role="status">
        Informasi privasi belum dapat dimuat. Muat ulang halaman untuk mencoba
        lagi.
      </p>
    );

  return (
    <>
      <section className={styles.security} aria-labelledby="consent-title">
        <h2 id="consent-title">Persetujuan Anda</h2>
        <ul className={styles.sessions}>
          {state.consents.map((consent) => (
            <li key={consent.kind}>
              <span>
                {consent.kind === "privacy"
                  ? "Pemberitahuan Privasi"
                  : "Syarat dan Ketentuan"}{" "}
                {consent.version}
              </span>
              <time dateTime={consent.grantedAt}>
                Diterima{" "}
                {new Date(consent.grantedAt).toLocaleDateString("id-ID")}
              </time>
            </li>
          ))}
        </ul>
      </section>
      <section
        className={styles.security}
        aria-labelledby="account-status-title"
      >
        <h2 id="account-status-title">Keamanan akun</h2>
        <p className={styles.hint}>
          Verifikasi email:{" "}
          {state.emailVerified ? "terverifikasi" : "belum terverifikasi"}.
        </p>
        <p className={styles.footerLink}>
          <Link href="/settings/security">
            Kelola kata sandi dan sesi aktif
          </Link>
        </p>
      </section>
      <section
        className={styles.security}
        aria-labelledby="legal-notices-title"
      >
        <h2 id="legal-notices-title">Pemberitahuan hukum</h2>
        <p className={styles.footerLink}>
          <Link href="/legal/terms">Syarat dan Ketentuan</Link> ·{" "}
          <Link href="/legal/privacy">Pemberitahuan Privasi</Link>
        </p>
        <p className={styles.hint}>
          Permintaan akses, koreksi, penghapusan, penarikan persetujuan, dan
          pembatasan pemrosesan belum tersedia di versi ini.
        </p>
      </section>
    </>
  );
}
