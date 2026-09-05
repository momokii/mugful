import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const sessionResponseSchema = z.object({
  session: z.object({ email: z.string(), expiresAt: z.string() }),
});

const internalOriginSchema = z.string().url();

export type ServerSession = Readonly<{
  email: string;
  expiresAt: string;
}>;

export const requireSession = async (): Promise<ServerSession> => {
  const cookieHeader = (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  if (cookieHeader === "") redirect("/login");

  const origin = internalOriginSchema.parse(process.env["API_INTERNAL_ORIGIN"]);
  const response = await fetch(`${origin}/v1/auth/session`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });
  if (response.status !== 200) redirect("/login");

  const parsed = sessionResponseSchema.safeParse(await response.json());
  if (!parsed.success) redirect("/login");

  return parsed.data.session;
};
