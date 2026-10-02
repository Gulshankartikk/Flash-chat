import api from '../../services/api';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

class WebRTCService {
  constructor() {
    this.peerConnections = new Map(); // toUserId -> RTCPeerConnection
    this.iceCandidateQueues = new Map(); // toUserId -> RTCIceCandidate[]
    this.makingOffer = new Map();
    this.ignoreOffer = new Map();
    this.isSettingRemoteAnswerPending = new Map();

    this.localStream = null;
    this.screenStream = null;
    this.iceServers = DEFAULT_ICE_SERVERS;

    // Callbacks
    this.onRemoteStream = null; // (userId, MediaStream) => void
    this.onPeerLeft = null; // (userId) => void
    this.onConnectionStateChange = null; // (userId, state) => void
  }

  /**
   * Fetch STUN/TURN ICE servers from backend
   */
  async loadIceServers() {
    try {
      const res = await api.get('/calls/ice-config');
      if (res.data?.data?.iceServers?.length > 0) {
        this.iceServers = res.data.data.iceServers;
      }
    } catch (err) {
      console.warn('Could not fetch ICE servers from backend, using Google STUN fallback', err);
      this.iceServers = DEFAULT_ICE_SERVERS;
    }
    return this.iceServers;
  }

  /**
   * Initialize local user media
   */
  async initLocalStream({ audio = true, video = false, facingMode = 'user' }) {
    // Clean up any existing local stream tracks first
    this.stopLocalStream();

    let stream = null;
    let fallbackToAudio = false;

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: video
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode
          }
        : false
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('getUserMedia failed with requested constraints:', err);
      // If video failed (e.g. no camera or permission denied), fallback to audio only
      if (video) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          fallbackToAudio = true;
        } catch (audioErr) {
          throw new Error('Microphone permission denied or device not found.');
        }
      } else {
        throw new Error('Microphone permission denied or device not found.');
      }
    }

    this.localStream = stream;
    return { stream, fallbackToAudio };
  }

  /**
   * Get or create RTCPeerConnection for a remote peer
   */
  getOrCreatePeerConnection(toUserId, { onSendIce, onSendOffer, polite = true } = {}) {
    if (this.peerConnections.has(toUserId)) {
      return this.peerConnections.get(toUserId);
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    });

    this.peerConnections.set(toUserId, pc);
    this.iceCandidateQueues.set(toUserId, []);
    this.makingOffer.set(toUserId, false);
    this.ignoreOffer.set(toUserId, false);
    this.isSettingRemoteAnswerPending.set(toUserId, false);

    // Attach local stream tracks to PC
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && onSendIce) {
        onSendIce(toUserId, event.candidate);
      }
    };

    // Remote Track handler
    pc.ontrack = (event) => {
      const remoteStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      if (this.onRemoteStream) {
        this.onRemoteStream(toUserId, remoteStream);
      }
    };

    // ICE Connection state change
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(toUserId, state);
      }

      if (state === 'failed') {
        console.warn(`ICE failed for peer ${toUserId}, attempting ICE restart`);
        pc.restartIce();
      } else if (state === 'disconnected') {
        console.warn(`ICE disconnected for peer ${toUserId}`);
      }
    };

    // Perfect Negotiation onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(toUserId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        if (onSendOffer) {
          onSendOffer(toUserId, pc.localDescription);
        }
      } catch (err) {
        console.error(`Negotiation needed error with ${toUserId}:`, err);
      } finally {
        this.makingOffer.set(toUserId, false);
      }
    };

    return pc;
  }

  /**
   * Handle incoming Offer SDP from remote peer
   */
  async handleOffer(fromUserId, sdp, { onSendAnswer, polite = true } = {}) {
    const pc = this.getOrCreatePeerConnection(fromUserId);
    const offerCollision =
      this.makingOffer.get(fromUserId) || pc.signalingState !== 'stable';

    this.ignoreOffer.set(fromUserId, !polite && offerCollision);
    if (this.ignoreOffer.get(fromUserId)) {
      console.warn(`Ignored offer collision for peer ${fromUserId}`);
      return;
    }

    this.isSettingRemoteAnswerPending.set(fromUserId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush any queued ICE candidates received prior to remote description
    await this.flushIceQueue(fromUserId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (onSendAnswer) {
      onSendAnswer(fromUserId, pc.localDescription);
    }
  }

  /**
   * Handle incoming Answer SDP from remote peer
   */
  async handleAnswer(fromUserId, sdp) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;

    this.isSettingRemoteAnswerPending.set(fromUserId, true);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.isSettingRemoteAnswerPending.set(fromUserId, false);

    // Flush queued candidates
    await this.flushIceQueue(fromUserId);
  }

  /**
   * Handle incoming ICE candidate from remote peer
   */
  async handleIceCandidate(fromUserId, candidate) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;

    try {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        const queue = this.iceCandidateQueues.get(fromUserId) || [];
        queue.push(candidate);
        this.iceCandidateQueues.set(fromUserId, queue);
      }
    } catch (err) {
      if (!this.ignoreOffer.get(fromUserId)) {
        console.warn(`Error adding ICE candidate for peer ${fromUserId}:`, err);
      }
    }
  }

  /**
   * Flush queued ICE candidates after remote description is set
   */
  async flushIceQueue(userId) {
    const pc = this.peerConnections.get(userId);
    const queue = this.iceCandidateQueues.get(userId) || [];
    if (!pc || queue.length === 0) return;

    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`Error applying queued ICE candidate:`, err);
      }
    }
    this.iceCandidateQueues.set(userId, []);
  }

  /**
   * Toggle local audio track enabled state
   */
  toggleAudio(enabled) {
    if (!this.localStream) return false;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    return enabled;
  }

  /**
   * Toggle local video track enabled state
   */
  toggleVideo(enabled) {
    if (!this.localStream) return false;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    return enabled;
  }

  /**
   * Upgrade audio call to video call (add camera track to all active peer connections)
   */
  async addVideoTrack() {
    if (!this.localStream) return null;

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      const newVideoTrack = videoStream.getVideoTracks()[0];
      this.localStream.addTrack(newVideoTrack);

      // Add track to all existing RTCPeerConnections
      for (const [userId, pc] of this.peerConnections.entries()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        } else {
          pc.addTrack(newVideoTrack, this.localStream);
        }
      }

      return newVideoTrack;
    } catch (err) {
      console.warn('Failed to add video track:', err);
      throw err;
    }
  }

  /**
   * Start desktop screen sharing
   */
  async startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      this.screenStream = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace current video track in all peer connections
      for (const [userId, pc] of this.peerConnections.entries()) {
        const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }
      }

      // Listen for user stopping screen share via native browser bar
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return screenStream;
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
      throw err;
    }
  }

  /**
   * Stop screen sharing and revert to camera track
   */
  async stopScreenShare() {
    if (!this.screenStream) return;

    this.screenStream.getTracks().forEach((t) => t.stop());
    this.screenStream = null;

    // Revert to camera track if exists
    const cameraTrack = this.localStream?.getVideoTracks()[0];
    for (const [userId, pc] of this.peerConnections.entries()) {
      const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      }
    }
  }

  /**
   * Mobile flip camera (toggle front/back facingMode)
   */
  async switchCamera(currentFacingMode = 'user') {
    const nextMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode }
      });
      const newTrack = newStream.getVideoTracks()[0];

      // Stop old video track
      const oldTrack = this.localStream?.getVideoTracks()[0];
      if (oldTrack) {
        oldTrack.stop();
        this.localStream.removeTrack(oldTrack);
      }

      this.localStream.addTrack(newTrack);

      // Replace in peer connections
      for (const [userId, pc] of this.peerConnections.entries()) {
        const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        }
      }

      return nextMode;
    } catch (err) {
      console.warn('Failed to switch camera:', err);
      return currentFacingMode;
    }
  }

  /**
   * Calculate network connection statistics (RTT and packet loss)
   */
  async getQualityStats(toUserId) {
    const pc = this.peerConnections.get(toUserId);
    if (!pc) return { quality: 'unknown', rtt: 0, packetLoss: 0 };

    try {
      const stats = await pc.getStats();
      let rtt = 0;
      let packetLoss = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : 0;
        }
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const packetsLost = report.packetsLost || 0;
          const packetsReceived = report.packetsReceived || 1;
          packetLoss = Math.round((packetsLost / (packetsLost + packetsReceived)) * 100);
        }
      });

      let quality = 'excellent';
      if (rtt > 300 || packetLoss > 10) quality = 'poor';
      else if (rtt > 150 || packetLoss > 3) quality = 'good';

      return { quality, rtt, packetLoss };
    } catch (err) {
      return { quality: 'unknown', rtt: 0, packetLoss: 0 };
    }
  }

  /**
   * Remove a single peer connection
   */
  removePeer(userId) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
      this.iceCandidateQueues.delete(userId);
      this.makingOffer.delete(userId);
      this.ignoreOffer.delete(userId);
      this.isSettingRemoteAnswerPending.delete(userId);
    }
    if (this.onPeerLeft) {
      this.onPeerLeft(userId);
    }
  }

  /**
   * Stop local stream media tracks
   */
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.screenStream = null;
    }
  }

  /**
   * Complete teardown
   */
  cleanup() {
    this.stopLocalStream();
    for (const [userId, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.iceCandidateQueues.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    this.isSettingRemoteAnswerPending.clear();
  }
}

export const webrtcService = new WebRTCService();
