"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

import {
  deleteRound,
  fetchOwnAccountId,
  fetchRoundsState,
  findPendingRound,
  isPendingRound,
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

  const pendings = state.rounds.filter(isPendingRound);
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
      <GuessMyAnswerStart onStarted={reload} />
      {pendings.length > 0 && (
        <section aria-labelledby="active-round-title" className={styles.history}>
          <h2 id="active-round-title">
            Active {pendings.length === 1 ? "round" : `rounds (${pendings.length})`}
          </h2>
          {pendings.map((round) => (
            <div
              key={round.roundId}
              className={styles.completedCard}
              style={{ borderStyle: "solid", borderColor: "var(--accent-primary)", marginBottom: "var(--space-3)" }}
            >
              <div className={styles.historyMetaRow}>
                <p className={styles.promptMeta}>
                  {round.category} · {formatRelative(round.createdAt)} · started by{" "}
                  {round.createdByAccountId === accountId ? "you" : round.partnerEmail ?? "partner"} · with{" "}
                  {round.partnerEmail ?? "your partner"}
                </p>
                <button
                  className={styles.deleteButton}
                  onClick={async () => {
                    if (!confirm("Delete this round for both of you?")) return;
                    const result = await deleteRound(round.roundId);
                    if (result.ok) await reload();
                    else alert(result.message);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
              <p className={styles.promptText} style={{ fontSize: "15px" }}>
                {round.promptText}
              </p>
              <p className={styles.hint}>Status: {round.status.replace(/-/g, " ")}</p>
            </div>
          ))}
          {pending && <GuessMyAnswerPending onReload={reload} round={pending} />}
        </section>
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
                  <>
                    <GuessMyAnswerCompleted
                      accountId={accountId}
                      onReload={reload}
                      round={round}
                    />
                    <button
                      className={styles.deleteButton}
                      onClick={async () => {
                        if (!confirm("Delete this history for both of you?")) return;
                        const result = await deleteRound(round.roundId);
                        if (result.ok) await reload();
                        else alert(result.message);
                      }}
                      type="button"
                    >
                      Delete history
                    </button>
                  </>
                ) : isPendingRound(round) ? (
                  <>
                    <p className={styles.promptText} style={{ fontSize: "15px" }}>
                      {round.promptText}
                    </p>
                    <div className={styles.historyMetaRow}>
                      <p className={styles.promptMeta}>
                        {round.category} · {formatRelative(round.createdAt)} · {round.status.replace(/-/g, " ")} · with{" "}
                        {round.partnerEmail ?? "your partner"} · started by{" "}
                        {round.createdByAccountId === accountId
                          ? "you"
                          : round.partnerEmail ?? "partner"}
                      </p>
                      <button
                        className={styles.deleteButton}
                        onClick={async () => {
                          if (!confirm("Delete this round for both of you?")) return;
                          const result = await deleteRound(round.roundId);
                          if (result.ok) await reload();
                          else alert(result.message);
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.promptText} style={{ fontSize: "15px" }}>
                      Cancelled — {round.promptText}
                    </p>
                    <div className={styles.historyMetaRow}>
                      <span className={styles.promptMeta}>
                        {round.category} · {formatRelative(round.createdAt)} · with{" "}
                        {round.partnerEmail ?? "your partner"} · started by{" "}
                        {round.createdByAccountId === accountId
                          ? "you"
                          : round.partnerEmail ?? "partner"}
                      </span>
                      <button
                        className={styles.deleteButton}
                        onClick={async () => {
                          if (!confirm("Delete this history for both of you?")) return;
                          const result = await deleteRound(round.roundId);
                          if (result.ok) await reload();
                          else alert(result.message);
                      }}
                      type="button"
                    >
                      Delete history
                    </button>
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
