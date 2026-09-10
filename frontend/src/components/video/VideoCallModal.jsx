import React, { useRef, useEffect, useState } from "react";
import { MicOff, VideoOff, Volume2 } from "lucide-react";
import LocalVideo from "./LocalVideo";
import VideoControls from "./VideoControls";
import useUserStore from "../../store/useUserStore";

const VideoCallModal = ({
  localStream,
  remoteStream,
  isMuted,
  isCamOff,
  isRemoteMuted = false,
  isRemoteCamOff = false,
  connectionState = "new",
  isScreenSharing,
  remoteUser,
  callType = "video",
  isInCall,
  isCalling,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onEndCall,
  onCancelCall,
}) => {
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [duration, setDuration] = useState(0);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Attach remote stream to hidden audio element for reliable voice and video audio
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Call duration counter
  useEffect(() => {
    let interval = null;
    if (isInCall) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInCall]);

  const formatDuration = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs > 0 ? hrs.toString().padStart(2, "0") + ":" : ""}${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentUser = useUserStore((state) => state.user);

  const name = remoteUser?.username || remoteUser?.name || "Flash Chat User";
  const avatar = remoteUser?.profilePicture;

  const handleEndOrCancel = () => {
    if (isCalling && onCancelCall) {
      onCancelCall();
    } else {
      onEndCall();
    }
  };

  // ── 1. Voice Call View ─────────────────────────────────────────────────────
  if (callType === "voice") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
        {/* Hidden audio element ensuring audio playback */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="w-full max-w-md bg-[#0f0f11] border border-[#222224] rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6">
          {/* Top Status */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#A0A0A0]">
            <Volume2 size={13} className="text-[#00E676]" />
            <span>Voice Call</span>
            <span>•</span>
            <span className={isInCall ? "text-[#00E676] font-mono" : "text-[#FFD166]"}>
              {isCalling ? "Calling..." : isInCall ? formatDuration(duration) : "Connecting..."}
            </span>
          </div>

          {/* Avatar / Animation */}
          <div className="relative my-2">
            {isInCall && (
              <div className="absolute inset-0 rounded-full bg-[#00E676]/20 animate-ping" />
            )}
            {isCalling && (
              <div className="absolute inset-0 rounded-full bg-[#FF6B00]/20 animate-pulse" />
            )}
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="w-28 h-28 rounded-full object-cover border-4 border-[#222224] relative z-10 shadow-xl"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-4xl border-4 border-[#222224] relative z-10 shadow-xl">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Participant Info & Mute Badge */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-xl font-bold text-white">{name}</h3>
              {isRemoteMuted && (
                <span className="flex items-center gap-1 text-[11px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">
                  <MicOff size={11} /> Muted
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E8E93]">
              {isCalling
                ? "Ringing remote phone..."
                : isInCall
                ? "Secure End-to-End Audio"
                : "Establishing peer connection..."}
            </p>
          </div>

          {/* Voice Wave Visualizer */}
          {isInCall && (
            <div className="flex items-end justify-center gap-1.5 h-10 w-full py-1">
              {[...Array(9)].map((_, i) => (
                <span
                  key={i}
                  className="w-1 bg-[#00E676] rounded-full animate-wave"
                  style={{
                    height: `${20 + ((i % 5) + 1) * 15}%`,
                    animationDelay: `${i * 120}ms`,
                    animationDuration: `${0.8 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="w-full pt-2">
            <VideoControls
              isMuted={isMuted}
              isCamOff={isCamOff}
              isScreenSharing={isScreenSharing}
              callType={callType}
              onToggleMic={onToggleMic}
              onToggleCam={onToggleCam}
              onToggleScreenShare={onToggleScreenShare}
              onEndCall={handleEndOrCancel}
            />
          </div>
        </div>

        <style>{`
          .animate-wave {
            animation-name: waveMotion;
            animation-iteration-count: infinite;
            animation-timing-function: ease-in-out;
          }
          @keyframes waveMotion {
            0%, 100% { height: 20%; }
            50% { height: 90%; }
          }
        `}</style>
      </div>
    );
  }

  // ── 2. Full-Screen Video Call View (matching reference screenshot) ───────────
  return (
    <div className="fixed inset-0 bg-[#08080a] z-50 flex flex-col justify-between items-center text-white select-none overflow-hidden">
      {/* Hidden audio element to guarantee audio play on all devices */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Main Remote Video or Avatar Container */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0c]">
        {!isCalling && remoteStream && !isRemoteCamOff ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-5 p-6 text-center max-w-sm">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-[#242428] shadow-2xl"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-5xl border-4 border-[#242428] shadow-2xl">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              {isRemoteCamOff && (
                <span className="absolute bottom-1 right-1 p-2 bg-black/80 rounded-full border border-white/20 text-white shadow">
                  <VideoOff size={16} />
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">{name}</h3>
                {isRemoteMuted && (
                  <span className="flex items-center gap-1 text-xs bg-rose-500/20 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                    <MicOff size={12} /> Muted
                  </span>
                )}
              </div>
              <p className="text-sm text-[#8E8E93]">
                {isCalling
                  ? "Calling participant..."
                  : isRemoteCamOff
                  ? "Participant's camera is turned off"
                  : "Connecting video feed..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Draggable Local Video Preview */}
      {(isInCall || isCalling) && (
        <LocalVideo
          stream={localStream}
          isCamOff={isCamOff}
          username={currentUser?.username || currentUser?.name || "Me"}
        />
      )}

      {/* Top Header Overlay */}
      <div className="z-20 w-full p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/20" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white drop-shadow">{name}</h2>
              {isRemoteMuted && (
                <span className="text-[11px] bg-rose-500/30 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40">
                  Muted
                </span>
              )}
            </div>
            <p className="text-xs text-[#A0A0A0] flex items-center gap-1.5 drop-shadow">
              {isCalling ? (
                <span className="animate-pulse text-[#FFD166]">Calling...</span>
              ) : isInCall ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
                  <span className="font-mono text-white/90">{formatDuration(duration)}</span>
                </>
              ) : (
                <span className="text-slate-300">Connecting WebRTC...</span>
              )}
            </p>
          </div>
        </div>

        {/* Connection state pill */}
        <div className="text-[11px] px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-white/70 backdrop-blur-md">
          {connectionState === "connected" ? "HD • E2EE Encrypted" : connectionState}
        </div>
      </div>

      {/* Bottom Control Overlay */}
      <div className="z-20 w-full p-6 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex justify-center">
        <VideoControls
          isMuted={isMuted}
          isCamOff={isCamOff}
          isScreenSharing={isScreenSharing}
          callType={callType}
          onToggleMic={onToggleMic}
          onToggleCam={onToggleCam}
          onToggleScreenShare={onToggleScreenShare}
          onEndCall={handleEndOrCancel}
        />
      </div>
    </div>
  );
};

export default VideoCallModal;
