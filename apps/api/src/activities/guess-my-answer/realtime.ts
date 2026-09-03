import type { Server } from "socket.io";

import { sessionTokenSchema } from "../../identity/session.js";
import type { IdentityService } from "../../identity/service.js";
import type { GuessMyAnswerService } from "./service.js";

export type RoundEventType =
  | "answer-submitted"
  | "reaction-added"
  | "round-cancelled"
  | "round-revealed"
  | "round-started";

export type RoundEventBus = Readonly<{
  roundUpdated: (
    spaceId: string,
    roundId: string,
    type: RoundEventType,
  ) => void;
}>;

type RealtimeGatewayDependencies = Readonly<{
  identityService: IdentityService;
  roundService: GuessMyAnswerService;
  sessionCookieName: string;
}>;

const parseCookies = (
  header: string | undefined,
): Readonly<Record<string, string>> => {
  if (header === undefined) return {};
  return Object.fromEntries(
    header.split(";").flatMap((segment) => {
      const [name, value] = segment.trim().split("=", 2);
      return name === undefined || value === undefined ? [] : [[name, value]];
    }),
  );
};

export const roundRoomName = (spaceId: string): string => `space:${spaceId}`;

export const wireRealtimeGateway = (
  io: Server,
  dependencies: RealtimeGatewayDependencies,
): RoundEventBus => {
  io.use(async (socket, next) => {
    const token = parseCookies(socket.handshake.headers.cookie)[
      dependencies.sessionCookieName
    ];
    const parsed = sessionTokenSchema.safeParse(token);
    if (!parsed.success) return next(new Error("unauthorized"));
    const session = await dependencies.identityService.authenticate(
      parsed.data,
    );
    if (session === undefined) return next(new Error("unauthorized"));
    const spaceId = await dependencies.roundService.activeSpaceId(
      session.accountId,
    );
    if (spaceId === undefined) return next(new Error("no couple space"));
    socket.data.accountId = session.accountId;
    socket.data.spaceId = spaceId;
    socket.join(roundRoomName(spaceId));
    next();
  });

  return {
    roundUpdated: (spaceId, roundId, type) => {
      io.to(roundRoomName(spaceId)).emit("round-updated", { roundId, type });
    },
  };
};
