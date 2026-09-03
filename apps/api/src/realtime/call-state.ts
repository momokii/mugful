export type CallState =
  "idle" | "ringing" | "connecting" | "connected" | "ended" | "failed";

export type CallDirection = "outgoing" | "incoming";

export type CallSession = Readonly<{
  connectedAt: number | undefined;
  endedAt: number | undefined;
  failedReason: string | undefined;
  restarts: number | undefined;
  ringingAt: number | undefined;
  spaceId: string;
  startedAt: number | undefined;
  state: CallState;
}>;

const RINGING_TIMEOUT_MS = 15_000;
const MAX_ICE_RESTARTS = 1;

export class CallStateMachine {
  private readonly calls = new Map<string, CallSession>();

  get(spaceId: string): CallSession {
    return (
      this.calls.get(spaceId) ?? {
        connectedAt: undefined,
        endedAt: undefined,
        failedReason: undefined,
        restarts: undefined,
        ringingAt: undefined,
        spaceId,
        startedAt: undefined,
        state: "idle",
      }
    );
  }

  start(spaceId: string, nowMs: number = Date.now()): CallSession {
    const current = this.get(spaceId);
    if (
      current.state !== "idle" &&
      current.state !== "ended" &&
      current.state !== "failed"
    ) {
      return current;
    }
    const next: CallSession = {
      connectedAt: undefined,
      endedAt: undefined,
      failedReason: undefined,
      restarts: 0,
      ringingAt: nowMs,
      spaceId,
      startedAt: nowMs,
      state: "ringing",
    };
    this.calls.set(spaceId, next);
    return next;
  }

  accept(spaceId: string, nowMs: number = Date.now()): CallSession {
    const current = this.get(spaceId);
    if (current.state !== "ringing") return current;
    const next: CallSession = { ...current, state: "connecting" };
    void nowMs;
    this.calls.set(spaceId, next);
    return next;
  }

  connected(spaceId: string, nowMs: number = Date.now()): CallSession {
    const current = this.get(spaceId);
    if (current.state !== "connecting") return current;
    const next: CallSession = {
      ...current,
      connectedAt: nowMs,
      state: "connected",
    };
    this.calls.set(spaceId, next);
    return next;
  }

  hangup(spaceId: string, nowMs: number = Date.now()): CallSession {
    const current = this.get(spaceId);
    if (
      current.state === "idle" ||
      current.state === "ended" ||
      current.state === "failed"
    ) {
      return current;
    }
    const next: CallSession = { ...current, endedAt: nowMs, state: "ended" };
    this.calls.set(spaceId, next);
    return next;
  }

  failed(
    spaceId: string,
    reason: string,
    nowMs: number = Date.now(),
  ): CallSession {
    const current = this.get(spaceId);
    if (
      current.state === "idle" ||
      current.state === "ended" ||
      current.state === "failed"
    ) {
      return current;
    }
    const next: CallSession = {
      ...current,
      endedAt: nowMs,
      failedReason: reason,
      state: "failed",
    };
    this.calls.set(spaceId, next);
    return next;
  }

  checkTimeouts(nowMs: number = Date.now()): string[] {
    const timedOut: string[] = [];
    for (const [spaceId, session] of this.calls) {
      if (
        session.state === "ringing" &&
        session.ringingAt !== undefined &&
        nowMs - session.ringingAt > RINGING_TIMEOUT_MS
      ) {
        this.calls.set(spaceId, {
          ...session,
          endedAt: nowMs,
          failedReason: "ringing-timeout",
          state: "failed",
        });
        timedOut.push(spaceId);
      }
    }
    return timedOut;
  }

  canIceRestart(spaceId: string): boolean {
    const current = this.get(spaceId);
    return current.state === "connected";
  }

  iceRestart(spaceId: string, nowMs: number = Date.now()): CallSession {
    const current = this.get(spaceId);
    if (current.state !== "connected") return current;
    const restarts = current.restarts ?? 0;
    if (restarts >= MAX_ICE_RESTARTS) {
      return this.failed(spaceId, "ice-restart-limit", nowMs);
    }
    const next: CallSession = {
      ...current,
      restarts: restarts + 1,
      state: "connecting",
    };
    this.calls.set(spaceId, next);
    return next;
  }

  clear(spaceId: string): void {
    this.calls.delete(spaceId);
  }
}
