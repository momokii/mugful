"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { mutateIdentity } from "../lib/identity-client";
import { useSession } from "./session-context";
import styles from "./site-header.module.css";

export function SiteHeader() {
  const { status, refresh } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await mutateIdentity("/auth/logout", "POST");
    } finally {
      await refresh();
      router.push("/login");
      router.refresh();
      setMenuOpen(false);
      setLoggingOut(false);
    }
  };

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
            <>
              {status.role === "admin" && (
                <Link className={styles.superadminLink} href="/superadmin">
                  Superadmin
                </Link>
              )}
              <Link className={styles.navLink} href="/home">
                Home
              </Link>
              <Link className={styles.navLink} href="/privacy">
                Privacy
              </Link>
              <Link className={styles.navLink} href="/settings/security">
                Security
              </Link>
              <div className={styles.userMenu}>
                <button
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="User menu"
                  className={styles.avatarButton}
                  onClick={() => setMenuOpen((value) => !value)}
                  type="button"
                >
                  <span className={styles.avatar}>
                    {status.session.email.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.userEmail}>{status.session.email}</span>
                  <span
                    className={
                      status.role === "admin"
                        ? styles.rolePillAdmin
                        : styles.rolePill
                    }
                  >
                    {status.role === "admin" ? "Admin" : "Member"}
                  </span>
                </button>
                {menuOpen && (
                  <div className={styles.dropdown} role="menu">
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownEmail}>
                        {status.session.email}
                      </span>
                      <span className={styles.dropdownRole}>
                        {status.role === "admin" ? "Administrator" : "Member"} ·{" "}
                        {new Date(status.session.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Link
                      className={styles.dropdownItem}
                      href="/home"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      Home
                    </Link>
                    <Link
                      className={styles.dropdownItem}
                      href="/onboarding"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      Couple space
                    </Link>
                    <Link
                      className={styles.dropdownItem}
                      href="/privacy"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      Privacy center
                    </Link>
                    <Link
                      className={styles.dropdownItem}
                      href="/settings/security"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      Security & sessions
                    </Link>
                    {status.role === "admin" && (
                      <Link
                        className={styles.dropdownItem}
                        href="/superadmin"
                        onClick={() => setMenuOpen(false)}
                        role="menuitem"
                      >
                        Prompt tooling
                      </Link>
                    )}
                    <button
                      className={styles.dropdownItemLogout}
                      disabled={loggingOut}
                      onClick={handleLogout}
                      role="menuitem"
                      type="button"
                    >
                      {loggingOut ? "Signing out…" : "Logout"}
                    </button>
                  </div>
                )}
              </div>
            </>
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
