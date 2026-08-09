import Link from "next/link";

import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.wordmark} href="/" aria-label="Mugful home">
          Mugful
        </Link>
        <nav className={styles.navigation} aria-label="Primary navigation">
          <Link className={styles.signInLink} href="/login">
            Sign in
          </Link>
          <Link className={styles.headerAction} href="/register">
            Create your space
          </Link>
        </nav>
      </div>
    </header>
  );
}
