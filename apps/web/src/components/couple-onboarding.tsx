"use client";

import { useEffect, useState } from "react";

import {
  identityMessage,
  mutateIdentity,
  readFragmentToken,
} from "../lib/identity-client";
import styles from "./auth-shell.module.css";

type CoupleOnboardingProperties = Readonly<{ mode: "create" | "join" }>;

const messageFor = (status: number): string =>
  status === 400
    ? "That invite is invalid or has expired."
    : status === 403
      ? "This action is not available for this account."
      : identityMessage({ body: undefined, error: undefined, status });

export function CoupleOnboarding({ mode }: CoupleOnboardingProperties) {
  const [inviteUrl, setInviteUrl] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    if (mode === "join") setToken(readFragmentToken());
  }, [mode]);

  const create = async () => {
    setPending(true);
    setMessage(undefined);
    try {
      const response = await mutateIdentity("/couple-space", "POST");
      if (response.status !== 201)
        return setMessage(messageFor(response.status));
      const body = response.body;
      if (
        typeof body !== "object" ||
        body === null ||
        !("inviteUrl" in body) ||
        typeof body.inviteUrl !== "string"
      )
        return setMessage("We could not create a private invite.");
      setInviteUrl(body.inviteUrl);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create an invite.",
      );
    } finally {
      setPending(false);
    }
  };

  const accept = async () => {
    if (token === undefined)
      return setMessage("Open the private invite link again.");
    setPending(true);
    setMessage(undefined);
    try {
      const response = await mutateIdentity("/couple-invites/accept", "POST", {
        token,
      });
      setMessage(
        response.status === 204
          ? "You are now connected. Your shared space is ready."
          : messageFor(response.status),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not accept this invite.",
      );
    } finally {
      setPending(false);
    }
  };

  const end = async () => {
    if (!window.confirm("End this shared space? Access stops immediately."))
      return;
    setPending(true);
    setMessage(undefined);
    try {
      const response = await mutateIdentity("/couple-space/end", "POST");
      setMessage(
        response.status === 204
          ? "This space has ended. Access stopped immediately; shared data enters a 30-day deletion grace period."
          : messageFor(response.status),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not end this space.",
      );
    } finally {
      setPending(false);
    }
  };

  if (mode === "join")
    return (
      <div className={styles.form}>
        <p className={styles.hint}>
          This link contains no couple content. Its private token was removed
          from the address bar in this browser.
        </p>
        <button
          className={styles.submit}
          disabled={pending || token === undefined}
          onClick={accept}
          type="button"
        >
          {pending ? "Connecting" : "Accept private invite"}
        </button>
        {message === undefined ? null : (
          <p aria-live="polite" className={styles.status}>
            {message}
          </p>
        )}
      </div>
    );

  return (
    <div className={styles.form}>
      <p className={styles.hint}>
        Create one private link for your partner. It expires after 7 days, works
        once, and is not sent by email.
      </p>
      <button
        className={styles.submit}
        disabled={pending}
        onClick={create}
        type="button"
      >
        {pending ? "Creating" : "Create private invite"}
      </button>
      {inviteUrl === undefined ? null : (
        <div className={styles.field}>
          <label htmlFor="invite-link">Copy this private link</label>
          <input id="invite-link" readOnly value={inviteUrl} />
        </div>
      )}
      <button
        className={styles.footerLink}
        disabled={pending}
        onClick={end}
        type="button"
      >
        End shared space
      </button>
      {message === undefined ? null : (
        <p aria-live="polite" className={styles.status}>
          {message}
        </p>
      )}
    </div>
  );
}
