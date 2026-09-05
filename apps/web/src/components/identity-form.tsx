"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  identityMessage,
  mutateIdentity,
  readFragmentToken,
} from "../lib/identity-client";
import styles from "./auth-shell.module.css";
import {
  IdentityFormFields,
  type IdentityFormMode,
} from "./identity-form-fields";
import { IdentityField } from "./identity-field";

export function IdentityForm({ mode }: Readonly<{ mode: IdentityFormMode }>) {
  const [message, setMessage] = useState<string | undefined>();
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "reset" || mode === "verify") setToken(readFragmentToken());
  }, [mode]);

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!passwordMismatch) return;
    const password = event.currentTarget.form?.elements.namedItem("password");
    const confirmation = event.currentTarget.form?.elements.namedItem(
      "passwordConfirmation",
    );
    if (
      password instanceof HTMLInputElement &&
      confirmation instanceof HTMLInputElement &&
      password.value === confirmation.value
    )
      setPasswordMismatch(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    if (
      (mode === "register" || mode === "reset" || mode === "password") &&
      password !== String(values.get("passwordConfirmation") ?? "")
    ) {
      setMessage(undefined);
      setPasswordMismatch(true);
      confirmationRef.current?.focus();
      return;
    }
    setPasswordMismatch(false);
    setPending(true);
    setMessage(undefined);
    try {
      const email = String(values.get("email") ?? "");
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
              : mode === "register"
                ? "If email verification is required, check your email for a verification link. If you do not receive one, check your spam folder or try signing in if you already have an account."
                : "Done. Check your email or continue with your account.",
        );
        if (mode === "login") window.location.assign("/home");
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
      <form aria-busy={pending} className={styles.form} onSubmit={submit}>
        {token === undefined ? (
          <IdentityField
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
          <p aria-atomic="true" aria-live="polite" className={styles.status}>
            {message}
          </p>
        )}
      </form>
    );

  return (
    <form aria-busy={pending} className={styles.form} onSubmit={submit}>
      <IdentityFormFields
        confirmationRef={confirmationRef}
        mode={mode}
        onPasswordChange={handlePasswordChange}
        passwordMismatch={passwordMismatch}
      />
      <button className={styles.submit} disabled={pending} type="submit">
        {pending ? "Working" : action(mode)}
      </button>
      {message === undefined ? null : (
        <p aria-atomic="true" aria-live="polite" className={styles.status}>
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

const action = (mode: Exclude<IdentityFormMode, "verify">): string =>
  ({
    forgot: "Send reset link",
    login: "Continue",
    password: "Change password",
    register: "Create account",
    reset: "Reset password",
  })[mode];
