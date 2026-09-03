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

  return (
    <div className={styles.console}>
      {pending === undefined ? (
        <GuessMyAnswerStart onStarted={reload} />
      ) : (
        <GuessMyAnswerPending onReload={reload} round={pending} />
      )}
      {archived.length === 0 ? null : (
        <section
          aria-labelledby="round-history-title"
          className={styles.history}
        >
          <h2 id="round-history-title">Past rounds</h2>
          <ul className={styles.historyList}>
            {archived.map((round) =>
              round.status === "completed" ? (
                <GuessMyAnswerCompleted
                  accountId={accountId}
                  key={round.roundId}
                  onReload={reload}
                  round={round}
                />
              ) : (
                <li className={styles.cancelledRow} key={round.roundId}>
                  Cancelled — {round.promptText}
                </li>
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
