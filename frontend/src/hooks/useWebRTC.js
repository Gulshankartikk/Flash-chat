/*
 * WEBRTC SIGNALING & MEDIA FLOW
 *
 * Signaling (via Socket.io):
 *
 * Caller                                     Receiver
 *   │                                           │
 *   │ 1. getUserMedia({ audio, video })         │
 *   │ 2. peerConnection.createOffer()           │
 *   │ 3. socket.emit("call_user", offer) ─────► │
 *   │                                           │ 4. Receives "incoming_call"
 *   │                                           │ 5. Accepts & getUserMedia()
 *   │                                           │ 6. peerConnection.setRemoteDescription(offer)
 *   │                                           │ 7. peerConnection.createAnswer()
 *   │ ◄── socket.emit("accept_call", answer) ── │
 *   │ 8. setRemoteDescription(answer)           │
 *   │                                           │
 *   │ ◄── "ice_candidate" exchange (STUN/TURN) ─►│
 *
 * Media Streaming (Direct Peer-to-Peer):
 *   Caller [Camera / Mic] ═════ Encrypted RTP (SRTP) ═════ Receiver [Speaker / Screen]
 *
 * Note: Audio & video data packets flow directly between browsers; Socket.io only handles
 * handshake signaling.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "../services/chat.services";
import { toast } from "react-toastify";

export const getIceServers = () => {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  if (process.env.REACT_APP_STUN_SERVER) {
    servers.unshift({ urls: process.env.REACT_APP_STUN_SERVER });
  }
  if (process.env.REACT_APP_TURN_SERVER) {
    servers.push({
      urls: process.env.REACT_APP_TURN_SERVER,
      username: process.env.REACT_APP_TURN_USERNAME || undefined,
      credential: process.env.REACT_APP_TURN_CREDENTIAL || undefined,
    });
  }
  return { iceServers: servers };
};

export const useWebRTC = (currentUser, onCallEnded, onIncomingCall, socketProp = null) => {
  const [localStream, setLocalStream]           = useState(null);
  const [remoteStream, setRemoteStream]         = useState(null);
  const [isMuted, setIsMuted]                   = useState(false);
  const [isCamOff, setIsCamOff]                 = useState(false);
  const [isRemoteMuted, setIsRemoteMuted]       = useState(false);
  const [isRemoteCamOff, setIsRemoteCamOff]     = useState(false);
  const [isScreenSharing, setIsScreenSharing]   = useState(false);
  const [isInCall, setIsInCall]                 = useState(false);
  const [isCalling, setIsCalling]               = useState(false);
  const [remoteUser, setRemoteUser]             = useState(null);
  const [callType, setCallType]                 = useState("video");
  const [roomId, setRoomId]                     = useState(null);
  const [permissionError, setPermissionError]   = useState(null);
  const [connectionState, setConnectionState]   = useState("new");
  const [iceState, setIceState]                 = useState("new");
  const [signalingState, setSignalingState]     = useState("stable");
  const [eventLogs, setEventLogs]               = useState([]);

  const pcRef                   = useRef(null);
  const localStreamRef          = useRef(null);
  const screenStreamRef         = useRef(null);
  const iceCandidatesQueueRef   = useRef([]);

  const socket = socketProp || getSocket();

  const addLog = useCallback((name, detail = "") => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLogs((prev) => [
      { id: `${Date.now()}_${Math.random()}`, time: timestamp, name, detail },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    addLog("CLEANUP_CALL");
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.onsignalingstatechange = null;
        pcRef.current.close();
      } catch (e) {
        console.warn("Error closing RTCPeerConnection:", e);
      }
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      screenStreamRef.current = null;
    }

    iceCandidatesQueueRef.current = [];

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCamOff(false);
    setIsRemoteMuted(false);
    setIsRemoteCamOff(false);
    setIsScreenSharing(false);
    setIsInCall(false);
    setIsCalling(false);
    setRemoteUser(null);
    setRoomId(null);
    setPermissionError(null);
    setConnectionState("closed");
    setIceState("closed");
    setSignalingState("closed");
  }, [addLog]);

  // ── User Media Helper with comprehensive error detection ────────────────
  const getUserMedia = useCallback(async (constraints) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Camera and microphone access requires HTTPS or localhost.";
      setPermissionError(msg);
      toast.error(msg);
      throw new Error(msg);
    }

    try {
      addLog("GET_USER_MEDIA_REQUEST", JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      addLog("GET_USER_MEDIA_SUCCESS", `Tracks: ${stream.getTracks().length}`);
      return stream;
    } catch (err) {
      let msg;
      switch (err.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          msg = "Microphone/camera access was denied. Please allow microphone/camera access in your browser settings.";
          break;
        case "NotFoundError":
        case "DevicesNotFoundError":
          msg = "No microphone or camera device found. Please connect an audio/video input device and try again.";
          break;
        case "NotReadableError":
        case "TrackStartError":
          msg = "Microphone/camera is already in use by another application or tab.";
          break;
        case "OverconstrainedError":
          msg = "Hardware does not support requested media constraints.";
          break;
        default:
          msg = `Media error: ${err.message || "Unknown error"}`;
      }
      setPermissionError(msg);
      addLog("GET_USER_MEDIA_ERROR", msg);
      toast.error(msg, { autoClose: 6000 });
      throw err;
    }
  }, [addLog]);

  // ── Drain Queued ICE Candidates ──────────────────────────────────────────
  const drainIceCandidates = useCallback((pc) => {
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      pc.addIceCandidate(candidate).catch((err) => {
        console.warn("Error adding queued ICE candidate:", err);
      });
    }
  }, []);

  // ── Init Peer Connection ────────────────────────────────────────────────
  const initPeerConnection = useCallback(
    (targetUserId) => {
      addLog("INIT_PEER_CONNECTION", `Target: ${targetUserId}`);
      const pc = new RTCPeerConnection(getIceServers());

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          addLog("ICE_CANDIDATE_SENT", event.candidate.candidate?.slice(0, 30));
          socket.emit("ice_candidate", {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        addLog("REMOTE_TRACK_RECEIVED", `${event.track.kind}: ${event.track.id}`);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          setRemoteStream((prev) => {
            const stream = prev ? new MediaStream(prev.getTracks()) : new MediaStream();
            stream.addTrack(event.track);
            return stream;
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        setIceState(pc.iceConnectionState);
        addLog("ICE_STATE_CHANGE", pc.iceConnectionState);
        if (["disconnected", "failed", "closed"].includes(pc.iceConnectionState)) {
          // Graceful auto end call on disconnect
          endCall();
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        addLog("PEER_CONNECTION_STATE_CHANGE", pc.connectionState);
        if (pc.connectionState === "connected") {
          setIsCalling(false);
          setIsInCall(true);
        }
      };

      pc.onsignalingstatechange = () => {
        setSignalingState(pc.signalingState);
        addLog("SIGNALING_STATE_CHANGE", pc.signalingState);
      };

      pcRef.current = pc;
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket, addLog]
  );

  // ── Start Call ──────────────────────────────────────────────────────────
  const startCall = useCallback(
    async (targetUser, type = "video") => {
      cleanupCall();
      setRemoteUser(targetUser);
      setCallType(type);
      setIsCalling(true);
      addLog("CALL_STARTED", `Type: ${type}, To: ${targetUser?.username || targetUser?._id}`);

      const newRoomId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setRoomId(newRoomId);

      try {
        const stream = await getUserMedia({
          video: type === "video",
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = initPeerConnection(targetUser._id);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        addLog("OFFER_SENT");

        socket?.emit("call_user", {
          to: targetUser._id,
          from: currentUser?._id,
          roomId: newRoomId,
          offer,
          callType: type,
          callerName: currentUser?.username || currentUser?.name || "Caller",
          callerAvatar: currentUser?.profilePicture || "",
        });
      } catch (err) {
        cleanupCall();
      }
    },
    [cleanupCall, getUserMedia, initPeerConnection, socket, currentUser, addLog]
  );

  // ── Accept Call ─────────────────────────────────────────────────────────
  const acceptCall = useCallback(
    async (incomingOffer, callerId) => {
      setIsCalling(false);
      setIsInCall(true);
      addLog("CALL_ACCEPTED", `Caller: ${callerId}`);

      try {
        const stream = await getUserMedia({
          video: callType === "video",
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = initPeerConnection(callerId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        drainIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        addLog("ANSWER_SENT");

        socket?.emit("accept_call", { to: callerId, answer });
      } catch (err) {
        rejectCall(callerId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callType, getUserMedia, initPeerConnection, socket, drainIceCandidates, addLog]
  );

  // ── Reject / Cancel / End Call ──────────────────────────────────────────
  const rejectCall = useCallback(
    (callerId) => {
      addLog("CALL_REJECTED", `Caller: ${callerId}`);
      socket?.emit("reject_call", { to: callerId });
      cleanupCall();
    },
    [socket, cleanupCall, addLog]
  );

  const cancelCall = useCallback(() => {
    if (socket && remoteUser) {
      addLog("CALL_CANCELLED", `To: ${remoteUser._id}`);
      socket.emit("cancel_call", { to: remoteUser._id });
    }
    cleanupCall();
    onCallEnded?.("Call cancelled");
  }, [socket, remoteUser, cleanupCall, onCallEnded, addLog]);

  const endCall = useCallback(() => {
    if (socket && remoteUser) {
      addLog("CALL_ENDED", `To: ${remoteUser._id}`);
      socket.emit("end_call", { to: remoteUser._id });
    }
    cleanupCall();
    onCallEnded?.("Call ended");
  }, [socket, remoteUser, cleanupCall, onCallEnded, addLog]);

  // ── Toggle Media Tracks with Signaling ───────────────────────────────────
  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const muted = !track.enabled;
      setIsMuted(muted);
      addLog("LOCAL_MIC_TOGGLE", muted ? "Muted" : "Unmuted");

      if (socket && remoteUser?._id) {
        socket.emit("media_state_changed", {
          to: remoteUser._id,
          type: "audio",
          enabled: !muted,
        });
      }
    }
  }, [socket, remoteUser, addLog]);

  const toggleCam = useCallback(() => {
    if (callType !== "video") return;
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const camOff = !track.enabled;
      setIsCamOff(camOff);
      addLog("LOCAL_CAM_TOGGLE", camOff ? "Camera Off" : "Camera On");

      if (socket && remoteUser?._id) {
        socket.emit("media_state_changed", {
          to: remoteUser._id,
          type: "video",
          enabled: !camOff,
        });
      }
    }
  }, [callType, socket, remoteUser, addLog]);

  // ── Screen Share ─────────────────────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (!isInCall || callType !== "video") return;

    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;

      try {
        const stream = await getUserMedia({ video: true, audio: false });
        const videoTrack = stream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);

        localStreamRef.current?.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
        localStreamRef.current?.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(false);
      } catch (err) {
        console.error("Failed to restore camera:", err);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];

        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);

        videoTrack.onended = () => toggleScreenShare();

        localStreamRef.current?.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
        localStreamRef.current?.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Failed to start screen share:", err);
        toast.error("Screen sharing was cancelled or failed.");
      }
    }
  }, [isInCall, callType, isScreenSharing, getUserMedia]);

  // ── Socket event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ from, offer, roomId, callType: incomingType, callerName, callerAvatar }) => {
      addLog("INCOMING_CALL_RECEIVED", `From: ${callerName || from}`);
      setRoomId(roomId);
      setCallType(incomingType || "video");
      setRemoteUser({
        _id: from,
        username: callerName,
        name: callerName,
        profilePicture: callerAvatar,
      });
      setIsCalling(false);
      onIncomingCall?.({ from, offer, roomId, callType: incomingType, callerName, callerAvatar });
    };

    const handleCallAccepted = async ({ answer }) => {
      addLog("CALL_ACCEPTED_RECEIVED");
      setIsCalling(false);
      setIsInCall(true);
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          drainIceCandidates(pcRef.current);
        } catch (err) {
          console.error("Error setting remote description from answer:", err);
        }
      }
    };

    const handleCallRejected = () => {
      addLog("CALL_REJECTED_RECEIVED");
      cleanupCall();
      onCallEnded?.("Call declined");
    };

    const handleCallCancelled = () => {
      addLog("CALL_CANCELLED_RECEIVED");
      cleanupCall();
      onCallEnded?.("Call cancelled by caller");
    };

    const handleIceCandidate = ({ candidate }) => {
      if (!candidate) return;
      addLog("ICE_CANDIDATE_RECEIVED");
      const rtcCandidate = new RTCIceCandidate(candidate);
      if (
        pcRef.current &&
        pcRef.current.remoteDescription &&
        pcRef.current.remoteDescription.type
      ) {
        pcRef.current.addIceCandidate(rtcCandidate).catch(() => {});
      } else {
        iceCandidatesQueueRef.current.push(rtcCandidate);
      }
    };

    const handleCallEnded = ({ reason } = {}) => {
      addLog("CALL_ENDED_RECEIVED", reason || "Call ended");
      cleanupCall();
      onCallEnded?.(reason || "Call ended");
    };

    const handleMediaStateChanged = ({ type, enabled }) => {
      addLog("MEDIA_STATE_CHANGED", `${type}: ${enabled ? "ON" : "OFF"}`);
      if (type === "audio") setIsRemoteMuted(!enabled);
      if (type === "video") setIsRemoteCamOff(!enabled);
    };

    const handleCallUserOffline = ({ message }) => {
      addLog("CALL_USER_OFFLINE", message);
      toast.warning(message || "User is currently offline.");
      cleanupCall();
      onCallEnded?.("User offline");
    };

    const handleCallUserBusy = ({ message }) => {
      addLog("CALL_USER_BUSY", message);
      toast.warning(message || "User is busy on another call.");
      cleanupCall();
      onCallEnded?.("User busy");
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_cancelled", handleCallCancelled);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_ended", handleCallEnded);
    socket.on("media_state_changed", handleMediaStateChanged);
    socket.on("call_user_offline", handleCallUserOffline);
    socket.on("call_user_busy", handleCallUserBusy);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_cancelled", handleCallCancelled);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_ended", handleCallEnded);
      socket.off("media_state_changed", handleMediaStateChanged);
      socket.off("call_user_offline", handleCallUserOffline);
      socket.off("call_user_busy", handleCallUserBusy);
    };
  }, [socket, cleanupCall, onCallEnded, onIncomingCall, drainIceCandidates, addLog]);

  return {
    localStream,
    remoteStream,
    isMuted,
    isCamOff,
    isRemoteMuted,
    isRemoteCamOff,
    isScreenSharing,
    isInCall,
    isCalling,
    remoteUser,
    callType,
    roomId,
    permissionError,
    connectionState,
    iceState,
    signalingState,
    eventLogs,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    getUserMedia,
  };
};