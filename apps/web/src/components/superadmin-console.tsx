"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  fetchSuperadminStatus,
  unavailableMessage,
  verifyPasskey,
  type SuperadminStatus,
} from "../lib/superadmin-client";
import { PromptCatalog } from "./superadmin-prompts";
import styles from "./superadmin.module.css";

export function SuperadminConsole() {
  const [message, setMessage] = useState<string | undefined>();
  const [status, setStatus] = useState<SuperadminStatus>({ kind: "checking" });
  const [verifying, setVerifying] = useState(false);

  const refresh = useCallback(async () => {
    setStatus({ kind: "checking" });
    try {
      setStatus(await fetchSuperadminStatus());
    } catch {
      setStatus({ kind: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verify = async () => {
    setVerifying(true);
    setMessage(undefined);
    try {
      const outcome = await verifyPasskey();
      if (outcome.ok) await refresh();
      else setMessage(outcome.message);
    } catch {
      setMessage(unavailableMessage);
    } finally {
      setVerifying(false);
    }
  };

  if (status.kind === "checking")
    return (
      <p aria-live="polite" className={styles.hint}>
        Checking your operational access.
      </p>
    );

  if (status.kind === "sign-in")
    return (
      <div className={styles.stateBox}>
        <p className={styles.notice}>
          This console needs a signed-in superadmin account.
        </p>
        <p className={styles.hint}>
          <Link href="/login">Sign in</Link>, then return to /superadmin.
        </p>
      </div>
    );

  if (status.kind === "forbidden")
    return (
      <div className={styles.stateBox}>
        <p className={styles.notice}>
          This account does not have the superadmin role. Ask an existing
          operator if you need access.
        </p>
      </div>
    );

  if (status.kind === "unavailable")
    return (
      <div className={styles.stateBox}>
        <p aria-live="polite" className={styles.notice}>
          {unavailableMessage}
        </p>
        <button className={styles.secondary} onClick={refresh} type="button">
          Try again
        </button>
      </div>
    );

  if (!status.mfaVerified)
    return (
      <section aria-busy={verifying} className={styles.mfa}>
        <h2>Confirm it is you</h2>
        <p className={styles.hint}>
          Prompt administration needs a passkey verification. It stays trusted
          for 15 minutes.
        </p>
        <button
          className={styles.primary}
          disabled={verifying}
          onClick={verify}
          type="button"
        >
          {verifying ? "Waiting for your passkey" : "Verify with passkey"}
        </button>
        {message === undefined ? null : (
          <p aria-live="assertive" className={styles.notice}>
            {message}
          </p>
        )}
      </section>
    );

  return (
    <div className={styles.console}>
      <p className={styles.hint}>
        Passkey verification is active for 15 minutes.
      </p>
      <PromptCatalog />
    </div>
  );
}
