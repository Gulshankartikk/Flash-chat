import React, { createContext, useState, useEffect, useRef, lazy, Suspense } from "react";
import { useWebRTC } from "../hooks/useWebRTC";
import useUserStore from "../store/useUserStore";
import { toast } from "react-toastify";

// Lazy-load WebRTC modals so they don't bloat the initial startup bundle
const VideoCallModal = lazy(() => import("../components/video/VideoCallModal"));
const IncomingCallModal = lazy(() => import("../components/video/IncomingCallModal"));

// Sound synthesizer using Web Audio API for ringtone — instantiated on-demand
class RingtoneSynth {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
  }

  start() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const playTone = () => {
        if (!this.audioCtx || this.audioCtx.state === "closed") return;
        try {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(440, this.audioCtx.currentTime); // Standard ring A4
          osc.frequency.setValueAtTime(480, this.audioCtx.currentTime + 0.1);

          gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1.2);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start();
          osc.stop(this.audioCtx.currentTime + 1.5);
        } catch (e) {
          // ignore transient audio errors
        }
      };

      playTone();
      this.intervalId = setInterval(playTone, 2000);
    } catch (e) {
      console.warn("AudioContext failed to start:", e);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}

export const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const currentUser = useUserStore((state) => state.user);
  const [incomingCallInfo, setIncomingCallInfo] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const ringtoneRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  const getRingtone = () => {
    if (!ringtoneRef.current) {
      ringtoneRef.current = new RingtoneSynth();
    }
    return ringtoneRef.current;
  };

  const onCallEnded = (reason) => {
    if (reason) toast.info(reason);
    setIncomingCallInfo(null);
    setShowCallModal(false);
    ringtoneRef.current?.stop();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  };

  const onIncomingCall = (callData) => {
    setIncomingCallInfo(callData);
    getRingtone().start();

    // Auto-decline call after 30s of no answer
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = setTimeout(() => {
      rejectIncomingCall();
      toast.info("Missed call");
    }, 30000);
  };

  const webrtc = useWebRTC(currentUser, onCallEnded, onIncomingCall);

  const startCall = (targetUser, type = "video") => {
    webrtc.startCall(targetUser, type);
    setShowCallModal(true);
  };

  const acceptIncomingCall = () => {
    if (incomingCallInfo) {
      ringtoneRef.current?.stop();
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      webrtc.acceptCall(incomingCallInfo.offer, incomingCallInfo.from);
      setIncomingCallInfo(null);
      setShowCallModal(true);
    }
  };

  const rejectIncomingCall = () => {
    if (incomingCallInfo) {
      ringtoneRef.current?.stop();
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      webrtc.rejectCall(incomingCallInfo.from);
      setIncomingCallInfo(null);
    }
  };

  const endActiveCall = () => {
    webrtc.endCall();
  };

  useEffect(() => {
    return () => {
      ringtoneRef.current?.stop();
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    };
  }, []);

  return (
    <CallContext.Provider
      value={{
        ...webrtc,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endCall: endActiveCall,
        incomingCallInfo,
        showCallModal,
        setShowCallModal,
      }}
    >
      {children}
      {incomingCallInfo && (
        <Suspense fallback={null}>
          <IncomingCallModal
            callerName={incomingCallInfo.callerName}
            callerAvatar={incomingCallInfo.callerAvatar}
            callType={incomingCallInfo.callType}
            onAccept={acceptIncomingCall}
            onDecline={rejectIncomingCall}
          />
        </Suspense>
      )}
      {showCallModal && (
        <Suspense fallback={null}>
          <VideoCallModal
            localStream={webrtc.localStream}
            remoteStream={webrtc.remoteStream}
            isMuted={webrtc.isMuted}
            isCamOff={webrtc.isCamOff}
            isScreenSharing={webrtc.isScreenSharing}
            remoteUser={webrtc.remoteUser}
            callType={webrtc.callType}
            isInCall={webrtc.isInCall}
            isCalling={webrtc.isCalling}
            onToggleMic={webrtc.toggleMic}
            onToggleCam={webrtc.toggleCam}
            onToggleScreenShare={webrtc.toggleScreenShare}
            onEndCall={endActiveCall}
          />
        </Suspense>
      )}
    </CallContext.Provider>
  );
};
