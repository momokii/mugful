"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

import {
  fetchOwnAccountId,
  fetchRoundsState,
  findPendingRound,
  unavailableMessage,
  type RoundsState,
} from "../lib/rounds-client";
import { GuessMyAnswerCompleted } from "./guess-my-answer-completed";
import { GuessMyAnswerPending } from "./guess-my-answer-pending";
import { GuessMyAnswerStart } from "./guess-my-answer-start";
import styles from "./guess-my-answer.module.css";

export function GuessMyAnswer() {
  const [accountId, setAccountId] = useState<string | undefined>();
  const [state, setState] = useState<RoundsState>({ kind: "checking" });
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      setAccountId(await fetchOwnAccountId());
      setState(await fetchRoundsState());
    } catch {
      setState({ kind: "unavailable" });
    }
  }, []);

  const reload = useCallback(async () => {
    setReloadKey((key) => key + 1);
    await refresh();
  }, [refresh]);

  const loadRounds = useCallback(async () => {
    try {
      setState(await fetchRoundsState());
    } catch {
      setState({ kind: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadKey]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const socket = io({ path: "/api/socket.io", withCredentials: true });
    socket.on("round-updated", () => {
      void loadRounds();
    });
    return () => {
      socket.disconnect();
    };
  }, [state.kind, loadRounds]);

  if (state.kind === "checking")
    return (
      <p aria-live="polite" className={styles.hint}>
        Opening your space.
      </p>
    );

  if (state.kind === "sign-in")
    return (
      <div className={styles.stateBox}>
        <p className={styles.notice}>
          Sign in to open your shared space and play together.
        </p>
        <p className={styles.hint}>
          <Link href="/login">Sign in</Link>, then come back to /home.
        </p>
      </div>
    );

  if (state.kind === "no-space")
    return (
      <div className={styles.stateBox}>
        <p className={styles.notice}>
          You do not have a shared space yet. Create one or join your partner to
          start playing.
        </p>
        <p className={styles.hint}>
          <Link href="/onboarding">Set up your space</Link> to continue.
        </p>
      </div>
    );

  if (state.kind === "unavailable")
    return (
      <div className={styles.stateBox}>
        <p aria-live="polite" className={styles.notice}>
          {unavailableMessage}
        </p>
        <button className={styles.secondary} onClick={refresh} type="button">
          Try again
        </button>
      </div>
    );

  const pending = findPendingRound(state.rounds);
  const archived = state.rounds.filter(
    (round) => round.status === "completed" || round.status === "cancelled",
  );

  const formatRelative = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className={styles.console}>
      {pending === undefined ? (
        <GuessMyAnswerStart onStarted={reload} />
      ) : (
        <>
          <section aria-labelledby="active-round-title" className={styles.history}>
            <h2 id="active-round-title">Active round</h2>
            <div className={styles.completedCard} style={{ borderStyle: "solid", borderColor: "var(--accent-primary)" }}>
              <p className={styles.promptMeta}>
                {pending.category} · {formatRelative(pending.createdAt)} · started by {pending.ownAnswer !== undefined ? "you" : "partner"} · with your partner
              </p>
              <p className={styles.promptText} style={{ fontSize: "15px" }}>
                {pending.promptText}
              </p>
              <p className={styles.hint}>Status: {pending.status.replace(/-/g, " ")}</p>
            </div>
          </section>
          <GuessMyAnswerPending onReload={reload} round={pending} />
        </>
      )}
      <section
        aria-labelledby="round-history-title"
        className={styles.history}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 id="round-history-title">History</h2>
          <span className={styles.hint}>{state.rounds.length} rounds</span>
        </div>
        {state.rounds.length === 0 ? (
          <p className={styles.hint}>No rounds yet — start one above.</p>
        ) : archived.length === 0 ? (
          <p className={styles.hint}>No finished rounds yet. Active round above.</p>
        ) : (
          <ul className={styles.historyList}>
            {state.rounds.map((round) => (
              <li
                key={round.roundId}
                className={round.status === "completed" ? styles.completedCard : styles.cancelledRow}
                style={
                  isPendingRound(round)
                    ? { opacity: 0.6, borderStyle: "dashed" }
                    : undefined
                }
              >
                {round.status === "completed" ? (
                  <GuessMyAnswerCompleted
                    accountId={accountId}
                    onReload={reload}
                    round={round}
                  />
                ) : isPendingRound(round) ? (
                  <>
                    <p className={styles.promptText} style={{ fontSize: "15px" }}>
                      {round.promptText}
                    </p>
                    <p className={styles.promptMeta}>
                      {round.category} · {formatRelative(round.createdAt)} · {round.status.replace(/-/g, " ")} · with partner
                    </p>
                  </>
                ) : (
                  <>
                    Cancelled — {round.promptText}
                    <br />
                    <span className={styles.promptMeta}>
                      {round.category} · {formatRelative(round.createdAt)}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
