import type { ChangeEventHandler, Ref } from "react";

import { ConsentAffirmations } from "./consent-affirmations";
import { IdentityField } from "./identity-field";

export type IdentityFormMode =
  "forgot" | "login" | "password" | "register" | "reset" | "verify";

type IdentityFormFieldsProperties = Readonly<{
  confirmationRef: Ref<HTMLInputElement>;
  mode: IdentityFormMode;
  onPasswordChange: ChangeEventHandler<HTMLInputElement>;
  passwordMismatch: boolean;
}>;

const passwordMismatchError = {
  id: "password-confirmation-error",
  message: "Passwords do not match.",
} as const;

const passwordHelper = "At least 12 characters.";

export function IdentityFormFields({
  confirmationRef,
  mode,
  onPasswordChange,
  passwordMismatch,
}: IdentityFormFieldsProperties) {
  return (
    <>
      {mode === "register" ? (
        <IdentityField
          label="Your name"
          name="displayName"
          type="text"
          autoComplete="name"
        />
      ) : null}
      {mode === "login" || mode === "register" || mode === "forgot" ? (
        <IdentityField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
        />
      ) : null}
      {mode === "password" ? (
        <IdentityField
          label="Current password"
          name="currentPassword"
          minLength={12}
          type="password"
          autoComplete="current-password"
        />
      ) : null}
      {mode !== "forgot" ? (
        <IdentityField
          label={
            mode === "password"
              ? "New password"
              : mode === "reset"
                ? "New password"
                : mode === "register"
                  ? "Create a password"
                  : "Password"
          }
          minLength={12}
          name="password"
          onChange={onPasswordChange}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          helper={mode === "login" ? undefined : passwordHelper}
        />
      ) : null}
      {mode === "register" || mode === "reset" || mode === "password" ? (
        <IdentityField
          autoComplete="new-password"
          label={
            mode === "password" ? "Confirm new password" : "Confirm password"
          }
          name="passwordConfirmation"
          type="password"
          helper={passwordHelper}
          inputRef={confirmationRef}
          onChange={onPasswordChange}
          error={passwordMismatch ? passwordMismatchError : undefined}
        />
      ) : null}
      {mode === "register" ? <ConsentAffirmations /> : null}
    </>
  );
}
