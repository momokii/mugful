"use client";

import { z } from "zod";

import { fetchJson, mutateIdentity } from "./identity-client";

export type PrivacyCommandResult =
  | Readonly<{ message: string; ok: false }>
  | Readonly<{ ok: true; status: string }>;

const messageForStatus = (status: number): string => {
  if (status === 400) return "Periksa kembali isian Anda, lalu coba lagi.";
  if (status === 401) return "Sesi Anda telah berakhir. Masuk kembali.";
  if (status === 403) return "Tindakan ini tidak tersedia untuk akun Anda.";
  return "Mugful tidak dapat menyelesaikan permintaan itu. Coba lagi.";
};

const statusSchema = z.object({ status: z.string() }).loose();

const exportSchema = z
  .object({
    account: z.object({ displayName: z.string(), email: z.string() }).loose(),
  })
  .loose();

export const fetchPrivacyExport = async (): Promise<
  PrivacyCommandResult & { data?: unknown }
> => {
  const response = await fetchJson("/privacy/export");
  if (response.status !== 200)
    return { message: messageForStatus(response.status), ok: false };
  const parsed = exportSchema.safeParse(response.body);
  if (!parsed.success)
    return { message: "Ekspor tidak dapat diproses.", ok: false };
  return { data: response.body, ok: true, status: "exported" };
};

export const correctProfile = async (
  displayName: string,
): Promise<PrivacyCommandResult> => {
  const response = await mutateIdentity("/privacy/correction", "POST", {
    displayName,
  });
  if (response.status === 200) return { ok: true, status: "corrected" };
  return { message: messageForStatus(response.status), ok: false };
};

export const requestDeletion = async (): Promise<PrivacyCommandResult> => {
  const response = await mutateIdentity("/privacy/deletion", "POST", {});
  const parsed = statusSchema.safeParse(response.body);
  if (response.status === 200 && parsed.success)
    return { ok: true, status: parsed.data.status };
  return { message: messageForStatus(response.status), ok: false };
};

export const withdrawConsent = async (): Promise<PrivacyCommandResult> => {
  const response = await mutateIdentity("/privacy/withdrawal", "POST", {});
  const parsed = statusSchema.safeParse(response.body);
  if (response.status === 200 && parsed.success)
    return { ok: true, status: parsed.data.status };
  return { message: messageForStatus(response.status), ok: false };
};

export const restrictProcessing = async (
  reason?: string,
): Promise<PrivacyCommandResult> => {
  const response = await mutateIdentity(
    "/privacy/restriction",
    "POST",
    reason === undefined ? {} : { reason },
  );
  const parsed = statusSchema.safeParse(response.body);
  if (response.status === 200 && parsed.success)
    return { ok: true, status: parsed.data.status };
  return { message: messageForStatus(response.status), ok: false };
};

export const liftRestriction = async (): Promise<PrivacyCommandResult> => {
  const response = await mutateIdentity(
    "/privacy/restriction/lift",
    "POST",
    {},
  );
  const parsed = statusSchema.safeParse(response.body);
  if (response.status === 200 && parsed.success)
    return { ok: true, status: parsed.data.status };
  return { message: messageForStatus(response.status), ok: false };
};
