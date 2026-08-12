"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  identityMessage,
  mutateIdentity,
  readFragmentToken,
} from "../lib/identity-client";
import styles from "./auth-shell.module.css";

type Mode = "forgot" | "login" | "password" | "register" | "reset" | "verify";

type IdentityFormProperties = Readonly<{ mode: Mode }>;

export function IdentityForm({ mode }: IdentityFormProperties) {
  const [message, setMessage] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    if (mode === "reset" || mode === "verify") setToken(readFragmentToken());
  }, [mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const values = new FormData(event.currentTarget);
    try {
      const email = String(values.get("email") ?? "");
      const password = String(values.get("password") ?? "");
      const response = await (() => {
        switch (mode) {
          case "register":
            return mutateIdentity("/auth/register", "POST", {
              adultAttestation: values.get("adult") === "on",
              displayName: String(values.get("displayName") ?? ""),
              email,
              password,
              privacyAccepted: values.get("privacy") === "on",
              termsAccepted: values.get("terms") === "on",
            });
          case "login":
            return mutateIdentity("/auth/login", "POST", { email, password });
          case "forgot":
            return mutateIdentity("/auth/password/forgot", "POST", { email });
          case "reset":
            return token === undefined
              ? Promise.resolve({
                  body: undefined,
                  error: "missing token",
                  status: 400,
                })
              : mutateIdentity("/auth/password/reset", "POST", {
                  newPassword: password,
                  token,
                });
          case "verify":
            return token === undefined
              ? mutateIdentity("/auth/verification/resend", "POST", { email })
              : mutateIdentity("/auth/verification/confirm", "POST", { token });
          case "password":
            return mutateIdentity("/auth/password", "POST", {
              currentPassword: String(values.get("currentPassword") ?? ""),
              newPassword: password,
            });
        }
      })();
      if (response.status >= 200 && response.status < 300) {
        setMessage(
          mode === "login"
            ? "Signed in. Your session is ready."
            : mode === "verify"
              ? "Your email address is verified. You can sign in now."
              : "Done. Check your email or continue with your account.",
        );
        if (mode === "login") window.location.assign("/settings/security");
      } else setMessage(identityMessage(response));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete that request.",
      );
    } finally {
      setPending(false);
    }
  };

  if (mode === "verify")
    return (
      <form className={styles.form} onSubmit={submit}>
        {token === undefined ? (
          <Field
            autoComplete="email"
            label="Email address"
            name="email"
            type="email"
          />
        ) : (
          <p className={styles.hint}>
            Your verification link is used only in this browser and never sent
            in a request URL.
          </p>
        )}
        <button className={styles.submit} disabled={pending} type="submit">
          {pending
            ? "Working"
            : token === undefined
              ? "Resend verification link"
              : "Verify email"}
        </button>
        {message === undefined ? null : (
          <p aria-live="polite" className={styles.status}>
            {message}
          </p>
        )}
      </form>
    );

  return (
    <form className={styles.form} onSubmit={submit}>
      {mode === "register" ? (
        <Field
          label="Your name"
          name="displayName"
          type="text"
          autoComplete="name"
        />
      ) : null}
      {mode === "login" || mode === "register" || mode === "forgot" ? (
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
        />
      ) : null}
      {mode === "password" ? (
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
        />
      ) : null}
      {mode !== "forgot" ? (
        <Field
          label={
            mode === "password"
              ? "New password"
              : mode === "reset"
                ? "New password"
                : mode === "register"
                  ? "Create a password"
                  : "Password"
          }
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      ) : null}
      {mode === "register" ? <ConsentAffirmations /> : null}
      <button className={styles.submit} disabled={pending} type="submit">
        {pending ? "Working" : action(mode)}
      </button>
      {message === undefined ? null : (
        <p aria-live="polite" className={styles.status}>
          {message}
        </p>
      )}
      {mode === "login" ? (
        <p className={styles.footerLink}>
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
      ) : null}
      {mode === "register" ? (
        <p className={styles.footerLink}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      ) : null}
    </form>
  );
}

function ConsentAffirmations() {
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

function Field(
  properties: Readonly<{
    autoComplete: string;
    label: string;
    name: string;
    type: string;
  }>,
) {
  return (
    <div className={styles.field}>
      <label htmlFor={properties.name}>{properties.label}</label>
      <input
        autoComplete={properties.autoComplete}
        id={properties.name}
        minLength={properties.type === "password" ? 12 : undefined}
        name={properties.name}
        required
        type={properties.type}
      />
    </div>
  );
}

const action = (mode: Exclude<Mode, "verify">): string =>
  ({
    forgot: "Send reset link",
    login: "Continue",
    password: "Change password",
    register: "Create account",
    reset: "Reset password",
  })[mode];
