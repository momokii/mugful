export const iceServers = ((): RTCIceServer[] => {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (
    turnUrl !== undefined &&
    turnUrl !== "" &&
    turnUsername !== undefined &&
    turnUsername !== "" &&
    turnCredential !== undefined &&
    turnCredential !== ""
  ) {
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { credential: turnCredential, urls: turnUrl, username: turnUsername },
    ];
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
})();

export const getMedia = async (withVideo: boolean): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo,
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
};

export const nextMuteState = (
  stream: MediaStream | null,
  muted: boolean,
): boolean => {
  const next = !muted;
  stream?.getAudioTracks().forEach((track) => {
    track.enabled = !next;
  });
  return next;
};

export const createCameraToggler =
  (
    localStreamRef: React.MutableRefObject<MediaStream | null>,
    pcRef: React.MutableRefObject<RTCPeerConnection | null>,
    localVideoRef: React.MutableRefObject<HTMLVideoElement | null>,
    getCameraOff: () => boolean,
    setCameraOff: (value: boolean) => void,
    setNotice: (message: string) => void,
  ) =>
  async () => {
    const cameraOff = getCameraOff();
    if (!cameraOff) {
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      setCameraOff(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack === undefined) throw new Error("no track");
      const localStream = localStreamRef.current;
      const peer = pcRef.current;
      const localVideo = localVideoRef.current;
      if (peer !== null && localStream !== null) {
        const sender = peer
          .getSenders()
          .find((sender) => sender.track?.kind === "video");
        if (sender) await sender.replaceTrack(videoTrack);
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack !== undefined) {
          oldTrack.stop();
          localStream.removeTrack(oldTrack);
        }
        localStream.addTrack(videoTrack);
        if (localVideo !== null) localVideo.srcObject = localStream;
      }
      setCameraOff(false);
    } catch {
      setNotice("Camera unavailable. Staying audio-only.");
    }
  };

export const createPeerConnection = (
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void,
  onStateChange: (state: RTCPeerConnectionState) => void,
): RTCPeerConnection => {
  const peer = new RTCPeerConnection({ iceServers });
  peer.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };
  peer.ontrack = (event) => {
    const stream = event.streams[0];
    if (stream !== undefined) onTrack(stream);
  };
  peer.onconnectionstatechange = () => onStateChange(peer.connectionState);
  return peer;
};
