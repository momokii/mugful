import { type ChangeEventHandler, type Ref, useState } from "react";

import fieldStyles from "./identity-field.module.css";
import styles from "./auth-shell.module.css";

type IdentityFieldProperties = Readonly<{
  autoComplete: string;
  helper?: string | undefined;
  error?: Readonly<{ id: string; message: string }> | undefined;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  minLength?: number | undefined;
  name: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  type: string;
}>;

export function IdentityField(properties: IdentityFieldProperties) {
  const [revealed, setRevealed] = useState(false);
  const helperId = `${properties.name}-hint`;
  const describedBy = [
    properties.helper === undefined ? undefined : helperId,
    properties.error?.id,
  ]
    .filter((id): id is string => id !== undefined)
    .join(" ");
  const input = (
    <input
      autoCapitalize={properties.type === "email" ? "none" : undefined}
      autoComplete={properties.autoComplete}
      autoCorrect={properties.type === "email" ? "off" : undefined}
      id={properties.name}
      minLength={properties.minLength}
      name={properties.name}
      onChange={properties.onChange}
      ref={properties.inputRef}
      required
      spellCheck={properties.type === "email" ? false : undefined}
      type={
        properties.type === "password" && revealed ? "text" : properties.type
      }
      aria-describedby={describedBy === "" ? undefined : describedBy}
      aria-invalid={properties.error === undefined ? undefined : true}
    />
  );

  return (
    <div className={styles.field}>
      <label htmlFor={properties.name}>{properties.label}</label>
      {properties.type === "password" ? (
        <div className={fieldStyles.passwordControl}>
          {input}
          <button
            aria-pressed={revealed}
            className={fieldStyles.passwordToggle}
            onClick={() => setRevealed((current) => !current)}
            type="button"
          >
            {revealed ? "Hide password" : "Show password"}
          </button>
        </div>
      ) : (
        input
      )}
      {properties.helper === undefined ? null : (
        <p className={styles.hint} id={helperId}>
          {properties.helper}
        </p>
      )}
      {properties.error === undefined ? null : (
        <p className={styles.fieldError} id={properties.error.id} role="alert">
          {properties.error.message}
        </p>
      )}
    </div>
  );
}
