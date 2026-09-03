"use client";

import { useCallback, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import {
  createCameraToggler,
  createPeerConnection,
  getMedia,
  nextMuteState,
} from "../lib/together-room-media";

import styles from "./guess-my-answer.module.css";
import { useTogetherRoomSignaling } from "./use-together-room-signaling";

type CallViewState =
  | "idle"
  | "outgoing-ringing"
  | "incoming-ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

export function TogetherRoom() {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<CallViewState>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const createPeer = useCallback(
    () =>
      createPeerConnection(
        (candidate) =>
          socketRef.current?.emit("call:ice-candidate", { candidate }),
        (stream) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
        },
        (state) => {
          if (state === "connected") setState("connected");
          if (state === "failed") setState("failed");
        },
      ),
    [],
  );

  useTogetherRoomSignaling(
    socketRef,
    (sdp) => {
      setState("incoming-ringing");
      (
        socketRef.current as unknown as { _pendingOffer?: string }
      )._pendingOffer = sdp;
    },
    async (sdp) => {
      const peer = pcRef.current;
      if (!peer) return;
      await peer.setRemoteDescription({ sdp, type: "answer" });
      setState("connecting");
    },
    async (candidate) => {
      await pcRef.current?.addIceCandidate(candidate);
    },
    () => {
      cleanup();
      setState("ended");
    },
    (message) => setNotice(message),
  );

  const startCall = async () => {
    if (!consent) {
      setNotice("Please confirm consent before starting a call.");
      return;
    }
    setNotice(undefined);
    setState("outgoing-ringing");
    const stream = await getMedia(!cameraOff);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const peer = createPeer();
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    pcRef.current = peer;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socketRef.current?.emit("call:offer", { sdp: offer.sdp ?? "" });
  };

  const acceptCall = async () => {
    if (!consent) {
      setNotice("Please confirm consent before answering.");
      return;
    }
    const pending = (socketRef.current as unknown as { _pendingOffer?: string })
      ?._pendingOffer;
    if (pending === undefined) {
      setNotice("No incoming call to accept.");
      return;
    }
    setState("connecting");
    const stream = await getMedia(!cameraOff);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const peer = createPeer();
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    pcRef.current = peer;
    await peer.setRemoteDescription({ sdp: pending, type: "offer" });
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socketRef.current?.emit("call:answer", { sdp: answer.sdp ?? "" });
  };

  const hangup = () => {
    socketRef.current?.emit("call:hangup", {});
    cleanup();
    setState("ended");
  };

  const toggleMute = () =>
    setMuted(nextMuteState(localStreamRef.current, muted));

  const toggleCamera = createCameraToggler(
    localStreamRef,
    pcRef,
    localVideoRef,
    () => cameraOff,
    setCameraOff,
    setNotice,
  );

  return (
    <section className={styles.card} aria-labelledby="together-room-title">
      <h2 id="together-room-title">Together Room</h2>
      <p className={styles.hint}>
        1:1 audio/video only. Media is never stored. Calls need explicit
        consent.
      </p>
      <p className={styles.notice} role="note">
        No recording. This indicator stays visible during every call.
      </p>
      <label className={styles.field}>
        <input
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          type="checkbox"
        />{" "}
        I consent to a 1:1 call with my partner in this space.
      </label>
      {state === "idle" && (
        <div className={styles.actions}>
          <button
            className={styles.primary}
            onClick={() => void startCall()}
            type="button"
          >
            Start call
          </button>
        </div>
      )}
      {state === "outgoing-ringing" && (
        <p className={styles.waitingBox}>Ringing…</p>
      )}
      {state === "incoming-ringing" && (
        <div className={styles.actions}>
          <button
            className={styles.primary}
            onClick={() => void acceptCall()}
            type="button"
          >
            Accept
          </button>
          <button className={styles.secondary} onClick={hangup} type="button">
            Decline
          </button>
        </div>
      )}
      {(state === "connecting" || state === "connected") && (
        <>
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              onClick={toggleMute}
              type="button"
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              className={styles.secondary}
              onClick={() => void toggleCamera()}
              type="button"
            >
              {cameraOff ? "Camera on" : "Camera off"}
            </button>
            <button className={styles.secondary} onClick={hangup} type="button">
              End call
            </button>
          </div>
          <div className={styles.actions}>
            <video
              autoPlay
              muted
              playsInline
              ref={localVideoRef}
              className={styles.answerBox}
            />
            <video
              autoPlay
              playsInline
              ref={remoteVideoRef}
              className={styles.answerBox}
            />
            <audio autoPlay ref={remoteAudioRef} />
          </div>
        </>
      )}
      {state === "ended" && <p className={styles.hint}>Call ended.</p>}
      {state === "failed" && (
        <p className={styles.notice}>Call failed. One reconnect was tried.</p>
      )}
      {notice === undefined ? null : (
        <p aria-live="polite" className={styles.notice}>
          {notice}
        </p>
      )}
    </section>
  );
}
