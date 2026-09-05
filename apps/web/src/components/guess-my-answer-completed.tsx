"use client";

import { useState } from "react";

import {
  reactToRound,
  unavailableMessage,
  type RoundView,
} from "../lib/rounds-client";
import styles from "./guess-my-answer.module.css";

const reactionChoices = ["🎉", "❤️", "😂", "😮"] as const;

export function GuessMyAnswerCompleted({
  accountId,
  onReload,
  round,
}: Readonly<{
  accountId: string | undefined;
  onReload: () => Promise<void>;
  round: RoundView;
}>) {
  const [notice, setNotice] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const partnerAnswer = round.answers?.find(
    (entry) => entry.accountId !== accountId,
  )?.answer;

  const react = async (reaction: string) => {
    setPending(true);
    setNotice(undefined);
    try {
      const outcome = await reactToRound(round.roundId, reaction);
      if (outcome.ok) await onReload();
      else setNotice(outcome.message);
    } catch {
      setNotice(unavailableMessage);
    } finally {
      setPending(false);
    }
  };

  const timeAgo = (() => {
    const diff = Date.now() - new Date(round.createdAt).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <li className={styles.completedCard}>
      <p className={styles.promptMeta}>
        {round.category} · {timeAgo} · with your partner · started by {round.ownAnswer !== undefined ? "you" : "partner"}
      </p>
      <p className={styles.promptText}>{round.promptText}</p>
      <p className={styles.promptMeta}>
        prompt version {round.promptVersionNumber} · {new Date(round.createdAt).toLocaleDateString()}
      </p>
      {round.match === undefined ? null : (
        <p
          className={`${styles.matchBadge} ${round.match ? styles.matched : styles.different}`}
        >
          {round.match ? "You matched!" : "Different answers — perfect talk"}
        </p>
      )}
      <div className={styles.answerBox}>
        <p className={styles.answerLabel}>Your answer</p>
        <p className={styles.answerText}>{round.ownAnswer ?? "—"}</p>
      </div>
      <div className={styles.answerBox}>
        <p className={styles.answerLabel}>Partner's answer</p>
        <p className={styles.answerText}>{partnerAnswer ?? "—"}</p>
      </div>
      {round.reactions === undefined ? null : (
        <p className={styles.reactionChips}>
          {round.reactions.length === 0
            ? "No reactions yet."
            : round.reactions.map((entry) => entry.reaction).join(" ")}
        </p>
      )}
      <div className={styles.reactions}>
        {reactionChoices.map((choice) => (
          <button
            aria-label={`React with ${choice}`}
            className={styles.reactionButton}
            disabled={pending}
            key={choice}
            onClick={() => void react(choice)}
            type="button"
          >
            {choice}
          </button>
        ))}
      </div>
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.notice}>
          {notice}
        </p>
      )}
    </li>
  );
}
