"use client";

import { useEffect, useState } from "react";

import { mutateIdentity } from "../lib/identity-client";
import styles from "./auth-shell.module.css";

type Session = Readonly<{
  createdAt: string;
  current: boolean;
  deviceLabel: string | undefined;
  id: string;
  lastSeenAt: string | null;
}>;

export function AccountSecurity() {
  const [sessions, setSessions] = useState<readonly Session[]>([]);
  const [message, setMessage] = useState("Loading active sessions.");
  useEffect(() => {
    void fetch("/api/v1/auth/sessions", { credentials: "same-origin" }).then(
      async (response) => {
        const body: unknown = await response.json();
        if (
          !response.ok ||
          typeof body !== "object" ||
          body === null ||
          !("sessions" in body) ||
          !Array.isArray(body.sessions)
        ) {
          setMessage("Sign in to review active sessions.");
          return;
        }
        setSessions(
          body.sessions.filter(
            (session): session is Session =>
              typeof session === "object" && session !== null,
          ),
        );
        setMessage("");
      },
    );
  }, []);
  const revoke = async (id: string) => {
    const result = await mutateIdentity(`/auth/sessions/${id}`, "DELETE");
    if (result.status === 204)
      setSessions((items) => items.filter((session) => session.id !== id));
    else setMessage("We could not revoke that session.");
  };
  const logout = async () => {
    const result = await mutateIdentity("/auth/logout", "POST");
    if (result.status === 204) window.location.assign("/login");
    else setMessage("We could not sign you out.");
  };
  return (
    <section className={styles.security} aria-labelledby="sessions-title">
      <h2 id="sessions-title">Active sessions</h2>
      {message === "" ? null : (
        <p aria-live="polite" className={styles.hint}>
          {message}
        </p>
      )}
      <ul className={styles.sessions}>
        {sessions.map((session) => (
          <li data-session-id={session.id} key={session.id}>
            <span>
              {session.deviceLabel ?? "Unknown device"}
              {session.current ? " (this device)" : ""}
            </span>
            {session.current ? null : (
              <button onClick={() => void revoke(session.id)} type="button">
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        className={styles.logout}
        onClick={() => void logout()}
        type="button"
      >
        Sign out of this device
      </button>
    </section>
  );
}
