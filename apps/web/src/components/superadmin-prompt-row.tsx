"use client";

import { type FormEvent, useState } from "react";

import {
  retirePrompt,
  updatePrompt,
  type SuperadminPrompt,
} from "../lib/superadmin-client";
import { PromptFieldGroup } from "./superadmin-prompt-fields";
import styles from "./superadmin.module.css";

type PromptRowProperties = Readonly<{
  onChanged: () => Promise<void>;
  prompt: SuperadminPrompt;
}>;

export function PromptRow({ onChanged, prompt }: PromptRowProperties) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = String(values.get(`${prompt.promptId}-text`) ?? "").trim();
    const category = String(
      values.get(`${prompt.promptId}-category`) ?? "",
    ).trim();
    const reason = String(values.get(`${prompt.promptId}-reason`) ?? "").trim();
    if (text === "" || category === "") {
      setNotice("Prompt text and a category are required to save.");
      return;
    }
    setPending(true);
    setNotice(undefined);
    const outcome = await updatePrompt(prompt.promptId, {
      category,
      reason: reason === "" ? undefined : reason,
      text,
    });
    setPending(false);
    if (!outcome.ok) {
      setNotice(outcome.message);
      return;
    }
    setEditing(false);
    setNotice("Saved. A new active version replaced the previous one.");
    await onChanged();
  };

  const retire = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    setNotice(undefined);
    const outcome = await retirePrompt(prompt.promptId);
    if (!outcome.ok) {
      setPending(false);
      setConfirming(false);
      setNotice(outcome.message);
      return;
    }
    await onChanged();
  };

  return (
    <li className={styles.promptRow}>
      {editing ? (
        <form className={styles.form} onSubmit={save}>
          <PromptFieldGroup
            category={prompt.category}
            idPrefix={prompt.promptId}
            reason=""
            text={prompt.text}
          />
          <div className={styles.actions}>
            <button className={styles.primary} disabled={pending} type="submit">
              Save new version
            </button>
            <button
              className={styles.secondary}
              onClick={() => {
                setEditing(false);
                setNotice(undefined);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={styles.promptText}>{prompt.text}</p>
          <p className={styles.meta}>
            {prompt.category} · version {prompt.version}
          </p>
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              onClick={() => {
                setConfirming(false);
                setEditing(true);
              }}
              type="button"
            >
              New version
            </button>
            {confirming ? (
              <>
                <button
                  className={styles.danger}
                  disabled={pending}
                  onClick={retire}
                  type="button"
                >
                  Confirm retire
                </button>
                <button
                  className={styles.secondary}
                  onClick={() => setConfirming(false)}
                  type="button"
                >
                  Keep prompt
                </button>
              </>
            ) : (
              <button
                className={styles.secondary}
                disabled={pending}
                onClick={retire}
                type="button"
              >
                Retire prompt
              </button>
            )}
          </div>
        </>
      )}
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.rowNotice}>
          {notice}
        </p>
      )}
    </li>
  );
}
