"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import styles from "./guess-my-answer.module.css";

type CallViewState =
  | "idle"
  | "outgoing-ringing"
  | "incoming-ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

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

  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("call:ice-candidate", {
          candidate: event.candidate,
        });
      }
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteVideoRef.current && stream)
        remoteVideoRef.current.srcObject = stream;
      if (remoteAudioRef.current && stream)
        remoteAudioRef.current.srcObject = stream;
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setState("connected");
      if (peer.connectionState === "failed") setState("failed");
    };
    return peer;
  }, []);

  useEffect(() => {
    const socket = io({ path: "/api/socket.io", withCredentials: true });
    socketRef.current = socket;
    socket.on("call:offer", async ({ sdp }: { sdp: string }) => {
      setState("incoming-ringing");
      (socket as unknown as { _pendingOffer?: string })._pendingOffer = sdp;
    });
    socket.on("call:answer", async ({ sdp }: { sdp: string }) => {
      const peer = pcRef.current;
      if (!peer) return;
      await peer.setRemoteDescription({ sdp, type: "answer" });
      setState("connecting");
    });
    socket.on(
      "call:ice-candidate",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await pcRef.current?.addIceCandidate(candidate);
        } catch {
          setNotice("ICE candidate failed. One restart will be tried.");
        }
      },
    );
    socket.on("call:hangup", () => {
      cleanup();
      setState("ended");
    });
    socket.on("connect_error", () =>
      setNotice("Realtime unavailable. Calls need an active space."),
    );
    return () => {
      socket.disconnect();
    };
  }, [cleanup, createPeer]);

  const getMedia = async (withVideo: boolean): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo,
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  };

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

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const toggleCamera = async () => {
    const next = !cameraOff;
    if (next) {
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      setCameraOff(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && pcRef.current && localStreamRef.current) {
        const sender = pcRef.current
          .getSenders()
          .find((sender) => sender.track?.kind === "video");
        if (sender) await sender.replaceTrack(videoTrack);
        localStreamRef.current
          .getVideoTracks()
          .forEach((track) => track.stop());
        localStreamRef.current.removeTrack(
          localStreamRef.current.getVideoTracks()[0]!,
        );
        localStreamRef.current.addTrack(videoTrack);
        if (localVideoRef.current)
          localVideoRef.current.srcObject = localStreamRef.current;
      }
      setCameraOff(false);
    } catch {
      setNotice("Camera unavailable. Staying audio-only.");
    }
  };

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
