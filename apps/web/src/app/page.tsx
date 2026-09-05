import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SiteHeader } from "../components/site-header";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (cookieHeader.length > 0) {
    try {
      const apiOrigin =
        process.env["API_INTERNAL_ORIGIN"] ?? "http://127.0.0.1:3001";
      const response = await fetch(`${apiOrigin}/v1/auth/session`, {
        cache: "no-store",
        headers: { cookie: cookieHeader },
      });
      if (response.ok) redirect("/home");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (message.includes("NEXT_REDIRECT")) throw error;
      void 0;
    }
  }
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>A private shared room</p>
            <h1 id="hero-title">Make distance feel a little smaller.</h1>
            <p className={styles.lead}>
              Mugful gives two people a calm place for small rituals, honest
              answers, and moments worth keeping close.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/register">
                Create your space
              </Link>
              <Link className={styles.secondaryAction} href="/login">
                Sign in
              </Link>
            </div>
          </div>
          <aside className={styles.note} aria-label="Mugful introduction">
            <p className={styles.noteLabel}>Made for two</p>
            <p className={styles.noteText}>
              No feeds. No scoreboards. Just a private place to meet each other
              in the middle.
            </p>
          </aside>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>Quiet by design. Shared with care.</p>
      </footer>
    </div>
  );
}
