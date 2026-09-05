"use client";

import Link from "next/link";

import { useSession } from "./session-context";
import styles from "./site-header.module.css";

export function SiteHeader() {
  const { status } = useSession();

  if (status.kind === "loading")
    return (
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span aria-hidden="true" className={styles.loadingWordmark} />
          <nav
            aria-busy="true"
            aria-label="Primary navigation"
            className={styles.navigation}
          >
            <span aria-hidden="true" className={styles.loadingSignIn} />
            <span aria-hidden="true" className={styles.loadingAction} />
          </nav>
        </div>
      </header>
    );

  const homeHref = status.kind === "authenticated" ? "/home" : "/";

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          className={styles.wordmark}
          href={homeHref}
          aria-label="Mugful home"
        >
          Mugful
        </Link>
        <nav className={styles.navigation} aria-label="Primary navigation">
          {status.kind === "authenticated" ? (
            <Link className={styles.headerAction} href="/onboarding">
              Create your space
            </Link>
          ) : (
            <>
              <Link className={styles.signInLink} href="/login">
                Sign in
              </Link>
              <Link className={styles.headerAction} href="/register">
                Create your space
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
