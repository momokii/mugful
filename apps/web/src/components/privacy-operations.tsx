"use client";

import { useState } from "react";

import {
  correctProfile,
  fetchPrivacyExport,
  liftRestriction,
  requestDeletion,
  restrictProcessing,
  withdrawConsent,
} from "../lib/privacy-client";
import styles from "./auth-shell.module.css";

export function PrivacyOperations() {
  const [notice, setNotice] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState("");
  const [reason, setReason] = useState("");

  const run = async (
    action: () => Promise<{ ok: boolean; message?: string; status?: string }>,
    success: string,
  ) => {
    const result = await action();
    setNotice(
      result.ok ? success : (result.message ?? "Gagal memproses permintaan."),
    );
  };

  return (
    <section
      className={styles.security}
      aria-labelledby="privacy-actions-title"
    >
      <h2 id="privacy-actions-title">Kelola data Anda</h2>
      <div className={styles.form} style={{ marginTop: "var(--space-4)" }}>
        <button
          className={styles.submit}
          onClick={() =>
            void run(
              () =>
                fetchPrivacyExport().then((r) =>
                  r.ok && r.data !== undefined
                    ? (window.open(
                        URL.createObjectURL(
                          new Blob([JSON.stringify(r.data, null, 2)], {
                            type: "application/json",
                          }),
                        ),
                        "_blank",
                      ),
                      r)
                    : r,
                ),
              "Ekspor disiapkan.",
            )
          }
          type="button"
        >
          Unduh ekspor data
        </button>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () => correctProfile(displayName),
              "Nama tampilan diperbarui.",
            );
          }}
        >
          <div className={styles.field}>
            <label htmlFor="correction-name">Koreksi nama tampilan</label>
            <input
              id="correction-name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Nama baru"
              value={displayName}
            />
          </div>
          <button className={styles.submit} type="submit">
            Simpan koreksi
          </button>
        </form>
        <div className={styles.sessions} style={{ marginTop: "var(--space-2)" }}>
          <button
            className={styles.logout}
            onClick={() =>
              void run(
                () => requestDeletion(),
                "Permintaan penghapusan dicatat. Masa tenggang 30 hari.",
              )
            }
            type="button"
          >
            Minta penghapusan akun
          </button>
          <button
            className={styles.logout}
            onClick={() =>
              void run(() => withdrawConsent(), "Persetujuan ditarik.")
            }
            type="button"
          >
            Tarik persetujuan
          </button>
        </div>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () => restrictProcessing(reason || undefined),
              "Pemrosesan dibatasi.",
            );
          }}
        >
          <div className={styles.field}>
            <label htmlFor="restriction-reason">
              Batasi pemrosesan (alasan opsional)
            </label>
            <input
              id="restriction-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Alasan pembatasan"
              value={reason}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className={styles.submit} style={{ flex: 1 }} type="submit">
              Batasi
            </button>
            <button
              className={styles.logout}
              style={{ flex: 1, marginTop: 0 }}
              onClick={() =>
                void run(() => liftRestriction(), "Pembatasan dicabut.")
              }
              type="button"
            >
              Cabut pembatasan
            </button>
          </div>
        </form>
      </div>
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.hint} style={{ marginTop: "var(--space-4)" }}>
          {notice}
        </p>
      )}
    </section>
  );
}
