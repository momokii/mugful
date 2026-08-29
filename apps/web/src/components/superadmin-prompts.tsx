"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  createPrompt,
  listPrompts,
  type SuperadminPrompt,
  unavailableMessage,
} from "../lib/superadmin-client";
import { PromptFieldGroup } from "./superadmin-prompt-fields";
import { PromptRow } from "./superadmin-prompt-row";
import styles from "./superadmin.module.css";

const emptyForm = { category: "", reason: "", text: "" };

export function PromptCatalog() {
  const [createKey, setCreateKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [prompts, setPrompts] = useState<readonly SuperadminPrompt[]>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const outcome = await listPrompts();
      if (outcome.ok) {
        setPrompts(outcome.data);
        setNotice(undefined);
      } else {
        setPrompts(undefined);
        setNotice(outcome.message);
      }
    } catch {
      setPrompts(undefined);
      setNotice(unavailableMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = String(values.get("create-text") ?? "").trim();
    const category = String(values.get("create-category") ?? "").trim();
    const reason = String(values.get("create-reason") ?? "").trim();
    if (text === "" || category === "") {
      setNotice("Add prompt text and a category before saving.");
      return;
    }
    setPending(true);
    setNotice(undefined);
    const outcome = await createPrompt({
      category,
      reason: reason === "" ? undefined : reason,
      text,
    });
    setPending(false);
    if (!outcome.ok) {
      setNotice(outcome.message);
      return;
    }
    setNotice("Prompt created. It is now active at version 1.");
    setCreateKey((key) => key + 1);
    await reload();
  };

  return (
    <section
      aria-busy={loading || pending}
      aria-labelledby="prompt-catalog-title"
      className={styles.catalog}
    >
      <h2 id="prompt-catalog-title">Prompt catalog</h2>
      <form className={styles.form} key={createKey} onSubmit={create}>
        <h3>Add a prompt</h3>
        <PromptFieldGroup {...emptyForm} idPrefix="create" />
        <div className={styles.actions}>
          <button className={styles.primary} disabled={pending} type="submit">
            Add prompt
          </button>
        </div>
      </form>
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.notice}>
          {notice}
        </p>
      )}
      <h3>Active prompts</h3>
      {loading && prompts === undefined ? (
        <p aria-live="polite" className={styles.hint}>
          Loading the prompt catalog.
        </p>
      ) : prompts === undefined ? null : prompts.length === 0 ? (
        <p className={styles.hint}>No active prompts yet.</p>
      ) : (
        <ul className={styles.promptList}>
          {prompts.map((prompt) => (
            <PromptRow
              key={prompt.promptId}
              onChanged={reload}
              prompt={prompt}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
