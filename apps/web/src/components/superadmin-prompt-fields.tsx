"use client";

import styles from "./superadmin.module.css";

type PromptFieldGroupProperties = Readonly<{
  category: string;
  idPrefix: string;
  reason: string;
  text: string;
}>;

export function PromptFieldGroup({
  category,
  idPrefix,
  reason,
  text,
}: PromptFieldGroupProperties) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-text`}>Prompt text</label>
        <textarea
          defaultValue={text}
          id={`${idPrefix}-text`}
          maxLength={500}
          name={`${idPrefix}-text`}
          required
          rows={3}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-category`}>Category</label>
        <input
          defaultValue={category}
          id={`${idPrefix}-category`}
          maxLength={64}
          name={`${idPrefix}-category`}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
          type="text"
        />
        <p className={styles.hint}>
          A short lowercase slug, such as memories or future-plans.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-reason`}>Reason (optional)</label>
        <input
          defaultValue={reason}
          id={`${idPrefix}-reason`}
          maxLength={500}
          name={`${idPrefix}-reason`}
          type="text"
        />
        <p className={styles.hint}>
          Kept only in the operational audit trail, never shown to couples.
        </p>
      </div>
    </>
  );
}
