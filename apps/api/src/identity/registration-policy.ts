import { z } from "zod";

export const registrationPolicyStates = ["disabled", "enabled"] as const;

export const registrationPolicyStateSchema = z.enum(registrationPolicyStates);

export type RegistrationPolicyState = z.infer<
  typeof registrationPolicyStateSchema
>;

export const registrationPolicyStateFromDefault = (
  registrationDefaultEnabled: boolean,
): RegistrationPolicyState =>
  registrationDefaultEnabled ? "enabled" : "disabled";
