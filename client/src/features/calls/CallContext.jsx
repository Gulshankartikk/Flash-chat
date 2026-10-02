import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocketStore, getSocket } from '../../services/socket';
import { useAuthStore } from '../../store/useAuthStore';
import { webrtcService } from './webrtcService';
import { ringtone } from './ringtone';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { socket } = useSocketStore();
  const currentSocket = socket || getSocket();
  const { user } = useAuthStore();
  const currentUserId = user?._id;

  // Call States: 'idle' | 'outgoing-ringing' | 'incoming-ringing' | 'connecting' | 'connected' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [currentCall, setCurrentCall] = useState(null);
  const [callType, setCallType] = useState('audio'); // 'audio' | 'video'
  const [incomingCall, setIncomingCall] = useState(null); // { call, caller }

  // Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream

  // Media Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [peerControls, setPeerControls] = useState({}); // userId -> { audio: boolean, video: boolean }

  // Status & Quality
  const [connectionQuality, setConnectionQuality] = useState('excellent'); // 'excellent' | 'good' | 'poor' | 'reconnecting'
  const [duration, setDuration] = useState(0);

  // References
  const timerRef = useRef(null);
  const originalTitleRef = useRef(document.title);
  const titleFlashIntervalRef = useRef(null);

  // ---------------------------------------------------------------------------
  // WebRTC Service Callbacks setup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    webrtcService.onRemoteStream = (userId, stream) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [userId]: stream
      }));
      setCallState('connected');
    };

    webrtcService.onPeerLeft = (userId) => {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    webrtcService.onConnectionStateChange = (userId, state) => {
      if (state === 'disconnected' || state === 'failed') {
        setConnectionQuality('reconnecting');
      } else if (state === 'connected') {
        setConnectionQuality('excellent');
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Call Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (callState === 'connected') {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // ---------------------------------------------------------------------------
  // Tab Title Flashing & Browser Notification for Incoming Calls
  // ---------------------------------------------------------------------------
  const startIncomingNotification = useCallback((callerName) => {
    if (titleFlashIntervalRef.current) clearInterval(titleFlashIntervalRef.current);

    let isFlashing = false;
    titleFlashIntervalRef.current = setInterval(() => {
      document.title = isFlashing
        ? `📞 Incoming Call from ${callerName}...`
        : `⚡ Flash Chat`;
      isFlashing = !isFlashing;
    }, 1000);

    // Browser Notification if supported and permitted
    if (document.hidden && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`Incoming Call from ${callerName}`, {
          body: 'Tap to answer on Flash Chat',
          icon: '/favicon.ico'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, []);

  const stopIncomingNotification = useCallback(() => {
    if (titleFlashIntervalRef.current) {
      clearInterval(titleFlashIntervalRef.current);
      titleFlashIntervalRef.current = null;
    }
    document.title = originalTitleRef.current;
  }, []);

  // ---------------------------------------------------------------------------
  // Internal Reset Helper
  // ---------------------------------------------------------------------------
  const resetCallState = useCallback(() => {
    ringtone.stop();
    stopIncomingNotification();
    webrtcService.cleanup();

    setCallState('idle');
    setCurrentCall(null);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStreams({});
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setPeerControls({});
    setConnectionQuality('excellent');
    setDuration(0);
  }, [stopIncomingNotification]);

  // ---------------------------------------------------------------------------
  // Socket.IO Call Event Listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    // Incoming Call
    const handleIncoming = ({ call, caller }) => {
      // If already in a call, notify caller busy
      if (callState !== 'idle') {
        socket.emit('call:decline', { callId: call._id, reason: 'busy' });
        return;
      }

      setIncomingCall({ call, caller });
      setCallType(call.type || 'audio');
      setCallState('incoming-ringing');
      ringtone.startIncoming();
      startIncomingNotification(caller.name || caller.username);
    };

    // Call Accepted
    const handleAccepted = async ({ callId, participant }) => {
      ringtone.stop();
      setCallState('connecting');

      // As caller, initiate WebRTC offer to the accepted participant
      try {
        const participantId = String(participant._id || participant);
        const pc = webrtcService.getOrCreatePeerConnection(participantId, {
          onSendIce: (toUid, candidate) => {
            socket.emit('call:ice', { callId, toUserId: toUid, candidate });
          },
          onSendOffer: (toUid, sdp) => {
            socket.emit('call:offer', { callId, toUserId: toUid, sdp });
          },
          polite: false
        });

        // Trigger offer creation
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', { callId, toUserId: participantId, sdp: pc.localDescription });
      } catch (err) {
        console.error('Failed to initiate WebRTC offer on call accepted:', err);
      }
    };

    // Call Declined
    const handleDeclined = () => {
      ringtone.stop();
      resetCallState();
    };

    // Recipient Busy
    const handleBusy = () => {
      ringtone.stop();
      alert('The recipient is currently on another call.');
      resetCallState();
    };

    // Call Missed
    const handleMissed = () => {
      ringtone.stop();
      resetCallState();
    };

    // Call Ended
    const handleEnded = () => {
      ringtone.stop();
      resetCallState();
    };

    // WebRTC Offer received
    const handleOffer = async ({ callId, fromUserId, sdp }) => {
      await webrtcService.handleOffer(fromUserId, sdp, {
        onSendAnswer: (toUid, answerSdp) => {
          socket.emit('call:answer', { callId, toUserId: toUid, sdp: answerSdp });
        },
        polite: true
      });
    };

    // WebRTC Answer received
    const handleAnswer = async ({ fromUserId, sdp }) => {
      await webrtcService.handleAnswer(fromUserId, sdp);
    };

    // WebRTC ICE Candidate received
    const handleIce = async ({ fromUserId, candidate }) => {
      await webrtcService.handleIceCandidate(fromUserId, candidate);
    };

    // Remote peer toggled audio or video
    const handlePeerToggle = ({ fromUserId, audio, video }) => {
      setPeerControls((prev) => ({
        ...prev,
        [fromUserId]: { audio, video }
      }));
    };

    // Remote peer upgraded to video
    const handleSwitchToVideo = () => {
      setCallType('video');
    };

    // Group call participant joined
    const handleParticipantJoined = async ({ callId, user: newUser }) => {
      const newUserId = String(newUser._id || newUser);
      if (newUserId === String(currentUserId)) return;

      // Create peer connection to new participant
      try {
        const pc = webrtcService.getOrCreatePeerConnection(newUserId, {
          onSendIce: (toUid, candidate) => {
            socket.emit('call:ice', { callId, toUserId: toUid, candidate });
          },
          onSendOffer: (toUid, sdp) => {
            socket.emit('call:offer', { callId, toUserId: toUid, sdp });
          },
          polite: true
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', { callId, toUserId: newUserId, sdp: pc.localDescription });
      } catch (err) {
        console.error('Error connecting to new participant:', err);
      }
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:declined', handleDeclined);
    socket.on('call:busy', handleBusy);
    socket.on('call:missed', handleMissed);
    socket.on('call:ended', handleEnded);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice', handleIce);
    socket.on('call:peer-toggle', handlePeerToggle);
    socket.on('call:switch-to-video', handleSwitchToVideo);
    socket.on('call:participant-joined', handleParticipantJoined);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:declined', handleDeclined);
      socket.off('call:busy', handleBusy);
      socket.off('call:missed', handleMissed);
      socket.off('call:ended', handleEnded);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice', handleIce);
      socket.off('call:peer-toggle', handlePeerToggle);
      socket.off('call:switch-to-video', handleSwitchToVideo);
      socket.off('call:participant-joined', handleParticipantJoined);
    };
  }, [socket, callState, currentUserId, startIncomingNotification, resetCallState]);

  // ---------------------------------------------------------------------------
  // Clean up on window unload
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentCall && socket) {
        socket.emit('call:end', { callId: currentCall._id });
      }
      webrtcService.cleanup();
      ringtone.stop();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentCall, socket]);

  // ---------------------------------------------------------------------------
  // Action: Start Call (audio or video)
  // ---------------------------------------------------------------------------
  const startCall = async ({ conversationId, type = 'audio' }) => {
    if (callState !== 'idle') {
      console.warn('Call already in progress');
      return;
    }

    try {
      setCallType(type);
      setCallState('outgoing-ringing');
      ringtone.startOutgoing();

      // 1. Load ICE servers
      await webrtcService.loadIceServers();

      // 2. Initialize local user media
      const { stream, fallbackToAudio } = await webrtcService.initLocalStream({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);

      if (fallbackToAudio && type === 'video') {
        setCallType('audio');
        alert('Camera not accessible. Proceeding with voice call.');
      }

      // 3. Emit call:start to backend
      socket.emit('call:start', { conversationId, type }, (res) => {
        if (!res?.success) {
          ringtone.stop();
          alert(res?.message || 'Could not initiate call');
          resetCallState();
          return;
        }

        setCurrentCall(res.call);
      });
    } catch (err) {
      console.error('Error starting call:', err);
      ringtone.stop();
      alert(err.message || 'Failed to access microphone or camera.');
      resetCallState();
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Accept Call
  // ---------------------------------------------------------------------------
  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      ringtone.stop();
      stopIncomingNotification();
      setCallState('connecting');

      const isVideo = incomingCall.call.type === 'video';
      setCallType(incomingCall.call.type);

      // 1. Load ICE servers
      await webrtcService.loadIceServers();

      // 2. Initialize local media
      const { stream, fallbackToAudio } = await webrtcService.initLocalStream({
        audio: true,
        video: isVideo
      });
      setLocalStream(stream);

      if (fallbackToAudio && isVideo) {
        setCallType('audio');
      }

      const callId = incomingCall.call._id;
      setCurrentCall(incomingCall.call);

      // 3. Prepare peer connection for the caller
      const callerId = String(incomingCall.caller._id || incomingCall.caller);
      webrtcService.getOrCreatePeerConnection(callerId, {
        onSendIce: (toUid, candidate) => {
          socket.emit('call:ice', { callId, toUserId: toUid, candidate });
        },
        onSendOffer: (toUid, sdp) => {
          socket.emit('call:offer', { callId, toUserId: toUid, sdp });
        },
        polite: true
      });

      // 4. Emit call:accept to backend
      socket.emit('call:accept', { callId }, (res) => {
        if (!res?.success) {
          alert(res?.message || 'Failed to accept call.');
          resetCallState();
          return;
        }
        setIncomingCall(null);
      });
    } catch (err) {
      console.error('Error accepting call:', err);
      alert(err.message || 'Failed to access media devices.');
      resetCallState();
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Decline Call
  // ---------------------------------------------------------------------------
  const declineCall = () => {
    if (!incomingCall) return;
    ringtone.stop();
    stopIncomingNotification();

    socket.emit('call:decline', { callId: incomingCall.call._id });
    resetCallState();
  };

  // ---------------------------------------------------------------------------
  // Action: End Call
  // ---------------------------------------------------------------------------
  const endCall = () => {
    ringtone.stop();
    stopIncomingNotification();

    if (currentCall) {
      if (callState === 'outgoing-ringing') {
        socket.emit('call:cancel', { callId: currentCall._id });
      } else {
        socket.emit('call:end', { callId: currentCall._id });
      }
    }

    resetCallState();
  };

  // ---------------------------------------------------------------------------
  // Media Toggles
  // ---------------------------------------------------------------------------
  const toggleAudio = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    webrtcService.toggleAudio(!nextState);

    if (currentCall && socket) {
      socket.emit('call:toggle', {
        callId: currentCall._id,
        audio: !nextState,
        video: !isVideoOff
      });
    }
  };

  const toggleVideo = () => {
    const nextState = !isVideoOff;
    setIsVideoOff(nextState);
    webrtcService.toggleVideo(!nextState);

    if (currentCall && socket) {
      socket.emit('call:toggle', {
        callId: currentCall._id,
        audio: !isMuted,
        video: !nextState
      });
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await webrtcService.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      try {
        await webrtcService.startScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        // Handled in webrtcService
      }
    }
  };

  const flipCamera = async () => {
    const nextMode = await webrtcService.switchCamera(facingMode);
    setFacingMode(nextMode);
  };

  const switchToVideo = async () => {
    try {
      await webrtcService.addVideoTrack();
      setCallType('video');
      setIsVideoOff(false);
      if (currentCall && socket) {
        socket.emit('call:switch-to-video', { callId: currentCall._id });
      }
    } catch (err) {
      alert('Could not start camera for video call.');
    }
  };

  const value = {
    callState,
    currentCall,
    callType,
    incomingCall,
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    isScreenSharing,
    facingMode,
    peerControls,
    connectionQuality,
    duration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    flipCamera,
    switchToVideo
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
