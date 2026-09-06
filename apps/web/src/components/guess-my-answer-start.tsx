"use client";

import { useEffect, useRef, useState } from "react";

import {
  startRound,
  suggestPrompt,
  unavailableMessage,
  type PromptSuggestion,
} from "../lib/rounds-client";
import styles from "./guess-my-answer.module.css";

export function GuessMyAnswerStart({
  onStarted,
}: Readonly<{ onStarted: () => Promise<void> }>) {
  const [category, setCategory] = useState("");
  const excludesRef = useRef<readonly string[]>([]);
  const [noPrompts, setNoPrompts] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<PromptSuggestion | undefined>();

  const roll = async (extraExcludes: readonly string[]) => {
    setPending(true);
    setNotice(undefined);
    excludesRef.current = [...excludesRef.current, ...extraExcludes];
    try {
      const outcome = await suggestPrompt(
        category === "" ? undefined : category,
        excludesRef.current,
      );
      if (outcome.ok) {
        setSuggestion(outcome.data);
        setNoPrompts(false);
      } else {
        setSuggestion(undefined);
        setNoPrompts(true);
        setNotice(outcome.message);
      }
    } catch {
      setNotice(unavailableMessage);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    void roll([]);
  }, []);

  const start = async () => {
    if (suggestion === undefined) return;
    setPending(true);
    try {
      const outcome = await startRound(suggestion.promptVersionId);
      if (outcome.ok) await onStarted();
      else setNotice(outcome.message);
    } catch {
      setNotice(unavailableMessage);
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-busy={pending} className={styles.card}>
      <h2>Start a round</h2>
      <p className={styles.hint}>
        Mugful will suggest a prompt for both of you to answer privately. This
        filter only picks <em>which mood</em> the suggestion comes from.
      </p>
      <div className={styles.field}>
        <label htmlFor="round-category">Mood / Category (optional)</label>
        <select
          className={styles.input}
          id="round-category"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          <option value="">All moods — random prompt</option>
          <option value="daily-life">daily-life</option>
          <option value="gratitude">gratitude</option>
          <option value="deep">deep</option>
          <option value="playful">playful</option>
        </select>
        <p className={styles.hint}>
          Leave empty for a random prompt. Choose a mood to filter
          superadmin-created prompts — e.g. <code>daily-life</code>. You don’t
          type your own question here; you’ll answer the suggestion after you
          press{" "}
          <strong>Start this round</strong>. If you see “No prompts left,” that
          mood has no active prompts — ask your superadmin to add more at{" "}
          <code>/superadmin</code>.
        </p>
      </div>
      {suggestion === undefined ? null : (
        <div className={styles.promptCard}>
          <p className={styles.promptText}>{suggestion.text}</p>
          <p className={styles.promptMeta}>
            {suggestion.category} · suggested for you
          </p>
        </div>
      )}
      {noPrompts ? (
        <p className={styles.notice}>
          No prompts left in that mood right now. Try another category or ask
          your superadmin to add more.
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          disabled={pending || suggestion === undefined}
          onClick={() => {
            if (suggestion !== undefined)
              void roll([suggestion.promptVersionId]);
          }}
          type="button"
        >
          Skip this prompt
        </button>
        <button
          className={styles.primary}
          disabled={pending || suggestion === undefined}
          onClick={() => void start()}
          type="button"
        >
          {pending ? "Working" : "Start this round"}
        </button>
      </div>
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.notice}>
          {notice}
        </p>
      )}
    </section>
  );
}
