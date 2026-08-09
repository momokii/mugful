import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

export const passwordHashSchema = z
  .string()
  .startsWith("$argon2id$")
  .brand<"PasswordHash">();

export type PasswordHash = z.infer<typeof passwordHashSchema>;

export const passwordHashPolicy = {
  algorithm: "argon2id",
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
} as const;

const argon2idAlgorithm = 2;

export const hashPassword = async (password: string): Promise<PasswordHash> =>
  passwordHashSchema.parse(
    await hash(password, {
      algorithm: argon2idAlgorithm,
      memoryCost: passwordHashPolicy.memoryCost,
      parallelism: passwordHashPolicy.parallelism,
      timeCost: passwordHashPolicy.timeCost,
    }),
  );

export const verifyPassword = async (input: {
  readonly password: string;
  readonly passwordHash: PasswordHash;
}): Promise<boolean> => verify(input.passwordHash, input.password);
