"use client";

import { useEffect, useRef } from "react";

import styles from "./guess-my-answer.module.css";

type RoundDeleteDialogProps = Readonly<{
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function RoundDeleteDialog({
  isDeleting,
  onCancel,
  onConfirm,
}: RoundDeleteDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  return (
    <div
      aria-describedby="delete-round-description"
      aria-labelledby="delete-round-title"
      aria-modal="true"
      className={styles.dialogBackdrop}
      onMouseDown={onCancel}
      role="presentation"
    >
      <section
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <h2 id="delete-round-title">Delete this round?</h2>
        <p id="delete-round-description">
          This permanently removes the round and its answers for both of you.
        </p>
        <div className={styles.dialogActions}>
          <button className={styles.secondary} disabled={isDeleting} onClick={onCancel} type="button">
            Keep round
          </button>
          <button
            className={styles.deleteButton}
            disabled={isDeleting}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {isDeleting ? "Deleting…" : "Delete round"}
          </button>
        </div>
      </section>
    </div>
  );
}
