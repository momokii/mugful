"use client";

import { type FormEvent, useState } from "react";

import {
  cancelRound,
  revealRound,
  submitAnswer,
  unavailableMessage,
  type RoundView,
} from "../lib/rounds-client";
import styles from "./guess-my-answer.module.css";

export function GuessMyAnswerPending({
  onReload,
  round,
}: Readonly<{
  onReload: () => Promise<void>;
  round: RoundView;
}>) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const act = async (action: () => Promise<void>) => {
    setPending(true);
    setNotice(undefined);
    try {
      await action();
    } catch {
      setNotice(unavailableMessage);
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const answer = String(
      new FormData(event.currentTarget).get("answer") ?? "",
    );
    if (answer.trim() === "") {
      setNotice("Write your answer before locking it in.");
      return;
    }
    setConfirmingCancel(false);
    void act(async () => {
      const outcome = await submitAnswer(round.roundId, answer);
      if (outcome.ok) await onReload();
      else setNotice(outcome.message);
    });
  };

  return (
    <section aria-busy={pending} className={styles.card}>
      <h2>Your round is waiting</h2>
      <div className={styles.promptCard}>
        <p className={styles.promptText}>{round.promptText}</p>
        <p className={styles.promptMeta}>
          {round.category} · prompt version {round.promptVersionNumber}
        </p>
      </div>
      {round.ownAnswer === undefined &&
      (round.status === "active" || round.status === "waiting-for-partner") ? (
        <form
          onSubmit={(event) => {
            submit(event);
          }}
        >
          <div className={styles.field}>
            <label htmlFor="round-answer">Your answer</label>
            <textarea
              className={styles.textarea}
              id="round-answer"
              maxLength={1000}
              name="answer"
              required
              rows={3}
            />
            <p className={styles.hint}>
              Your partner cannot see it until you lock it in.
            </p>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={pending} type="submit">
              Lock in your answer
            </button>
          </div>
        </form>
      ) : null}
      {round.ownAnswer !== undefined && round.status === "waiting-for-partner" ? (
        <>
          <div className={styles.answerBox}>
            <p className={styles.answerLabel}>Your locked answer</p>
            <p className={styles.answerText}>{round.ownAnswer}</p>
          </div>
          <p className={styles.waitingBox}>
            Submitted! Your partner has not answered yet — no rush, no deadline.
          </p>
        </>
      ) : null}
      {round.status === "ready-to-reveal" ? (
        <p className={styles.waitingBox}>
          You have both answered. Time to see each other.
        </p>
      ) : null}
      {round.status === "ready-to-reveal" ? (
        <div className={styles.actions}>
          <button
            className={styles.primary}
            disabled={pending}
            onClick={() =>
              void act(async () => {
                const outcome = await revealRound(round.roundId);
                if (outcome.ok) await onReload();
                else setNotice(outcome.message);
              })
            }
            type="button"
          >
            Reveal your answers
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          {confirmingCancel ? (
            <>
              <span className={styles.hint}>Cancel this round?</span>
              <button
                className={styles.secondary}
                disabled={pending}
                onClick={() =>
                  void act(async () => {
                    const outcome = await cancelRound(round.roundId);
                    if (outcome.ok) await onReload();
                    else setNotice(outcome.message);
                  })
                }
                type="button"
              >
                Yes, cancel it
              </button>
              <button
                className={styles.secondary}
                onClick={() => setConfirmingCancel(false)}
                type="button"
              >
                Keep playing
              </button>
            </>
          ) : (
            <button
              className={styles.secondary}
              disabled={pending}
              onClick={() => setConfirmingCancel(true)}
              type="button"
            >
              Cancel this round
            </button>
          )}
        </div>
      )}
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.notice}>
          {notice}
        </p>
      )}
    </section>
  );
}
