import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Share2,
  SwitchCamera,
  Signal,
  Wifi,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useCall } from './CallContext';
import { Avatar } from '../../components/Avatar';

export const CallScreen = () => {
  const {
    callState,
    currentCall,
    callType,
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    isScreenSharing,
    connectionQuality,
    duration,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    flipCamera,
    switchToVideo
  } = useCall();

  const [isPipTopLeft, setIsPipTopLeft] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video element references
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType, isVideoOff]);

  // Bind remote streams to video elements
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      const el = remoteVideoRefs.current[userId];
      if (el && stream) {
        el.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  if (callState === 'idle' || callState === 'incoming-ringing') {
    return null;
  }

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const isVideoCall = callType === 'video';
  const remoteUserIds = Object.keys(remoteStreams);
  const isGroup = remoteUserIds.length > 1;

  // Header display name and avatar
  const displayName = currentCall?.conversation?.name || currentCall?.caller?.name || 'Call';
  const displayAvatar =
    currentCall?.conversation?.avatar || currentCall?.caller?.avatar || '';

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111827] text-white overflow-hidden select-none">
      {/* Top Bar: Caller Info, Duration, Quality */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <Avatar src={displayAvatar} alt={displayName} size="md" />
          <div>
            <h3 className="text-base font-bold tracking-tight text-white drop-shadow-sm">
              {displayName}
            </h3>
            <p className="text-xs font-semibold text-orange-400 drop-shadow-sm">
              {callState === 'outgoing-ringing' && 'Ringing...'}
              {callState === 'connecting' && 'Connecting...'}
              {callState === 'connected' && formatTimer(duration)}
            </p>
          </div>
        </div>

        {/* Quality Indicator & Fullscreen toggle */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${
              connectionQuality === 'reconnecting'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : connectionQuality === 'poor'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span className="capitalize">{connectionQuality}</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Call View Area */}
      <div className="relative flex-1 flex items-center justify-center w-full h-full">
        {/* Reconnecting Overlay Banner */}
        {connectionQuality === 'reconnecting' && (
          <div className="absolute top-20 z-30 px-4 py-2 rounded-2xl bg-rose-600/90 text-white text-xs font-bold shadow-lg backdrop-blur-md animate-bounce">
            ⚠️ Network unstable. Reconnecting call...
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* AUDIO CALL VIEW: Ambient gradient + pulsing avatar */}
        {/* ------------------------------------------------------------------ */}
        {!isVideoCall ? (
          <div className="flex flex-col items-center justify-center p-8 text-center relative w-full h-full">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#F97316]/30 via-[#EC4899]/20 to-[#111827] pointer-events-none" />

            <div className="relative mb-6">
              {/* Concentric pulsing rings */}
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                className="absolute -inset-8 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] blur-md"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#F97316] to-[#F43F5E] blur-xs"
              />
              <Avatar
                src={displayAvatar}
                alt={displayName}
                size="2xl"
                className="relative z-10 shadow-2xl border-4 border-white/20 w-32 h-32"
              />
            </div>

            <h2 className="text-2xl font-black tracking-tight text-white mb-2 relative z-10">
              {displayName}
            </h2>
            <p className="text-sm font-semibold text-orange-300 relative z-10">
              {callState === 'outgoing-ringing'
                ? 'Ringing...'
                : callState === 'connecting'
                ? 'Securing connection...'
                : `Voice Call · ${formatTimer(duration)}`}
            </p>

            {/* Remote audio elements */}
            {remoteUserIds.map((userId) => (
              <audio
                key={userId}
                ref={(el) => {
                  if (el && remoteStreams[userId]) {
                    el.srcObject = remoteStreams[userId];
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
              />
            ))}
          </div>
        ) : (
          /* ---------------------------------------------------------------- */
          /* VIDEO CALL VIEW: Remote video tiles + Floating local PIP */
          /* ---------------------------------------------------------------- */
          <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
            {/* If no remote stream yet, show connecting state */}
            {remoteUserIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Avatar src={displayAvatar} alt={displayName} size="2xl" className="shadow-2xl" />
                <p className="text-sm font-semibold text-orange-300 animate-pulse">
                  {callState === 'outgoing-ringing'
                    ? 'Calling video...'
                    : 'Connecting video stream...'}
                </p>
              </div>
            ) : isGroup ? (
              /* Group Video Grid (up to 4 participants) */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full h-full max-h-[82vh] p-2">
                {remoteUserIds.slice(0, 4).map((uid) => (
                  <div
                    key={uid}
                    className="relative rounded-3xl overflow-hidden bg-gray-900 border border-white/10 shadow-lg flex items-center justify-center"
                  >
                    <video
                      ref={(el) => (remoteVideoRefs.current[uid] = el)}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1.5">
                      <span>Peer</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 1:1 Large Remote Video */
              <div className="relative w-full h-full rounded-3xl overflow-hidden bg-gray-900 flex items-center justify-center">
                <video
                  ref={(el) => (remoteVideoRefs.current[remoteUserIds[0]] = el)}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Local Video PIP (Picture-In-Picture) */}
            <motion.div
              drag
              dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
              onClick={() => setIsPipTopLeft(!isPipTopLeft)}
              className={`absolute z-30 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/40 bg-black cursor-pointer ${
                isPipTopLeft ? 'top-20 left-4' : 'top-20 right-4'
              }`}
            >
              {isVideoOff ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-400 p-2 text-center text-xs">
                  <VideoOff className="w-6 h-6 mb-1 text-rose-400" />
                  <span>Camera off</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              )}
              <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-semibold text-white">
                You
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="p-4 sm:p-6 pb-8 z-30 flex items-center justify-center">
        <div className="flex items-center gap-3 sm:gap-4 px-6 py-3.5 rounded-full bg-black/70 backdrop-blur-xl border border-white/20 shadow-2xl">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`p-3.5 rounded-full transition cursor-pointer ${
              isMuted
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera Toggle */}
          {isVideoCall ? (
            <button
              type="button"
              onClick={toggleVideo}
              className={`p-3.5 rounded-full transition cursor-pointer ${
                isVideoOff
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          ) : (
            /* Switch to video */
            <button
              type="button"
              onClick={switchToVideo}
              className="p-3.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition cursor-pointer"
              title="Switch to video call"
            >
              <Video className="w-5 h-5" />
            </button>
          )}

          {/* Flip Camera (for mobile/video) */}
          {isVideoCall && (
            <button
              type="button"
              onClick={flipCamera}
              className="p-3.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition cursor-pointer"
              title="Flip camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {/* Screen Share (desktop) */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`hidden sm:flex p-3.5 rounded-full transition cursor-pointer ${
              isScreenSharing
                ? 'bg-[#F97316] text-white hover:bg-orange-600'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <Share2 className="w-5 h-5" />
          </button>

          {/* Speaker Toggle */}
          <button
            type="button"
            onClick={toggleSpeaker}
            className="p-3.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition cursor-pointer"
            title={isSpeakerOn ? 'Speaker on' : 'Speaker off'}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={endCall}
            className="p-4 rounded-full bg-gradient-to-r from-rose-600 to-[#F43F5E] text-white shadow-lg shadow-rose-600/50 hover:scale-105 active:scale-95 transition cursor-pointer ml-2"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
