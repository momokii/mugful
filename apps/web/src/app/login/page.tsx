import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "../../components/auth-shell";
import styles from "../../components/auth-shell.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      description="Come back to the quiet place you share."
      eyebrow="Welcome back"
      title="Sign in to Mugful"
    >
      <form className={styles.form} method="post">
        <div className={styles.field}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <p className={styles.hint}>
          This screen is a visual foundation. Sign in will be connected in the
          auth slice.
        </p>
        <button className={styles.submit} type="submit">
          Continue
        </button>
      </form>
      <p className={styles.footerLink}>
        New to Mugful? <Link href="/register">Create your space</Link>
      </p>
    </AuthShell>
  );
}
