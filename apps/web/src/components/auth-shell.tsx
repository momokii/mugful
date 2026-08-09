import type { ReactNode } from "react";

import { SiteHeader } from "./site-header";
import styles from "./auth-shell.module.css";

type AuthShellProperties = Readonly<{
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}>;

export function AuthShell({
  children,
  description,
  eyebrow,
  title,
}: AuthShellProperties) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.panel} aria-labelledby="auth-title">
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className={styles.description}>{description}</p>
          {children}
        </section>
      </main>
    </div>
  );
}
