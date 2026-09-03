"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

export function useTogetherRoomSignaling(
  socketRef: React.MutableRefObject<Socket | null>,
  onOffer: (sdp: string) => void,
  onAnswer: (sdp: string) => void,
  onIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>,
  onHangup: () => void,
  onError: (message: string) => void,
): void {
  useEffect(() => {
    const socket = io({ path: "/api/socket.io", withCredentials: true });
    socketRef.current = socket;
    socket.on("call:offer", async ({ sdp }: { sdp: string }) => onOffer(sdp));
    socket.on("call:answer", async ({ sdp }: { sdp: string }) => onAnswer(sdp));
    socket.on(
      "call:ice-candidate",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await onIceCandidate(candidate);
        } catch {
          onError("ICE candidate failed. One restart will be tried.");
        }
      },
    );
    socket.on("call:hangup", () => onHangup());
    socket.on("connect_error", () =>
      onError("Realtime unavailable. Calls need an active space."),
    );
    return () => {
      socket.disconnect();
    };
  }, [socketRef, onOffer, onAnswer, onIceCandidate, onHangup, onError]);
}
