"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

import { fetchJson } from "../lib/identity-client";

const sessionSchema = z.object({ email: z.string(), expiresAt: z.string() });

const sessionResponseSchema = z.object({ session: sessionSchema }).loose();

export type Session = Readonly<{ email: string; expiresAt: string }>;

export type SessionStatus =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "authenticated"; session: Session }>
  | Readonly<{ kind: "unauthenticated" }>;

export const parseSessionResponse = (body: unknown): Session | undefined => {
  const parsed = sessionResponseSchema.safeParse(body);
  return parsed.success
    ? { email: parsed.data.session.email, expiresAt: parsed.data.session.expiresAt }
    : undefined;
};

const fetchSession = async (): Promise<Session | undefined> => {
  const response = await fetchJson("/auth/session");
  if (response.status !== 200) return undefined;
  return parseSessionResponse(response.body);
};

type SessionContextValue = Readonly<{
  refresh: () => Promise<void>;
  status: SessionStatus;
}>;

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<SessionStatus>({ kind: "loading" });

  const refresh = useCallback(async () => {
    try {
      const session = await fetchSession();
      setStatus(
        session === undefined
          ? { kind: "unauthenticated" }
          : { kind: "authenticated", session },
      );
    } catch {
      setStatus({ kind: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({ refresh, status }),
    [refresh, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (context === undefined)
    throw new Error("useSession must be used within a SessionProvider");
  return context;
};
