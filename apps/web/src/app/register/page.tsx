import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "../../components/auth-shell";
import styles from "../../components/auth-shell.module.css";

export const metadata: Metadata = {
  title: "Create your space",
};

export default function RegisterPage() {
  return (
    <AuthShell
      description="Start a private place for the two of you."
      eyebrow="A place for two"
      title="Create your Mugful space"
    >
      <form className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="register-name">Your name</label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="register-password">Create a password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className={styles.hint}>Use at least 8 characters.</p>
        </div>
        <p className={styles.hint}>
          This screen is a visual foundation. Registration will be connected in
          the auth slice.
        </p>
        <button className={styles.submit} type="button">
          Create space
        </button>
      </form>
      <p className={styles.footerLink}>
        Already have a space? <Link href="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
