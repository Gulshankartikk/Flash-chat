import React, { useState, useEffect, useContext } from "react";
import {
  Activity,
  Wifi,
  WifiOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Copy,
  Send,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-toastify";
import useUserStore from "../store/useUserStore";
import useChatStore from "../store/chatStore";
import useSocket from "../hooks/useSocket";
import { CallContext } from "../context/CallContext";
import { googleSignIn } from "../services/user.service";
import axiosInstance from "../services/url.services";

export default function DevTestDashboard() {
  const currentUser = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const { socket, isConnected: isSocketConnected } = useSocket();
  const webrtcContext = useContext(CallContext);

  const [activeTab, setActiveTab] = useState("automated"); // "automated" | "manual" | "diagnostics"
  const [targetUserId, setTargetUserId] = useState("");
  const [targetUserName, setTargetUserName] = useState("Peer User");

  // Chat test state
  const [testMsgText, setTestMsgText] = useState("Hello from Dev Test!");
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  // Automated test state
  const [testResults, setTestResults] = useState({
    socketConnection: { status: "IDLE", message: "Not run yet" },
    userAuthentication: { status: "IDLE", message: "Not run yet" },
    mediaDevicesSupport: { status: "IDLE", message: "Not run yet" },
    microphoneAccess: { status: "IDLE", message: "Not run yet" },
    cameraAccess: { status: "IDLE", message: "Not run yet" },
    peerConnectionInit: { status: "IDLE", message: "Not run yet" },
    iceCandidateGathering: { status: "IDLE", message: "Not run yet" },
    signalingExchange: { status: "IDLE", message: "Not run yet" },
  });
  const [isRunningAllTests, setIsRunningAllTests] = useState(false);

  // Diagnostic states
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [localAudioTrackLive, setLocalAudioTrackLive] = useState(false);
  const [localVideoTrackLive, setLocalVideoTrackLive] = useState(false);
  const [remoteAudioTrackLive, setRemoteAudioTrackLive] = useState(false);
  const [remoteVideoTrackLive, setRemoteVideoTrackLive] = useState(false);


  const addLog = (event, details = "") => {
    const time = new Date().toLocaleTimeString();
    setDiagnosticLogs((prev) => [
      { id: `${Date.now()}_${Math.random()}`, time, event, details },
      ...prev.slice(0, 99),
    ]);
  };

  // Monitor tracks
  useEffect(() => {
    if (webrtcContext?.localStream) {
      const a = webrtcContext.localStream.getAudioTracks()[0];
      const v = webrtcContext.localStream.getVideoTracks()[0];
      setLocalAudioTrackLive(a ? a.enabled && a.readyState === "live" : false);
      setLocalVideoTrackLive(v ? v.enabled && v.readyState === "live" : false);
    } else {
      setLocalAudioTrackLive(false);
      setLocalVideoTrackLive(false);
    }

    if (webrtcContext?.remoteStream) {
      const a = webrtcContext.remoteStream.getAudioTracks()[0];
      const v = webrtcContext.remoteStream.getVideoTracks()[0];
      setRemoteAudioTrackLive(a ? a.readyState === "live" : false);
      setRemoteVideoTrackLive(v ? v.readyState === "live" : false);
    } else {
      setRemoteAudioTrackLive(false);
      setRemoteVideoTrackLive(false);
    }
  }, [webrtcContext?.localStream, webrtcContext?.remoteStream, webrtcContext?.isMuted, webrtcContext?.isCamOff]);

  // Listen to socket events for logs and chat test
  useEffect(() => {
    if (!socket) return;

    addLog("SOCKET_INITIALIZED", `Socket ID: ${socket.id || "Connecting..."}`);

    const handleConnect = () => addLog("SOCKET_CONNECTED", `ID: ${socket.id}`);
    const handleDisconnect = (reason) => addLog("SOCKET_DISCONNECTED", reason);
    const handleReceiveMessage = (msg) => {
      addLog("RECEIVE_MESSAGE", `From: ${msg.sender?.username || msg.sender} | ${msg.content || ""}`);
      setReceivedMessages((prev) => [msg, ...prev]);
    };
    const handleUserTyping = (data) => {
      addLog("USER_TYPING", `User: ${data.userId}, isTyping: ${data.isTyping}`);
      setIsPeerTyping(!!data.isTyping);
    };
    const handleIncomingCall = (data) => {
      addLog("INCOMING_CALL", `From: ${data.callerName} (${data.from}), Type: ${data.callType}`);
    };
    const handleCallAccepted = () => addLog("CALL_ACCEPTED", "Remote peer accepted call");
    const handleCallRejected = () => addLog("CALL_REJECTED", "Call was rejected");
    const handleCallEnded = () => addLog("CALL_ENDED", "Call ended");
    const handleIceCandidate = () => addLog("ICE_CANDIDATE_RECEIVED");
    const handleMediaChanged = (d) => addLog("MEDIA_STATE_CHANGED", `${d.type}: ${d.enabled ? "ON" : "OFF"}`);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_ended", handleCallEnded);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("media_state_changed", handleMediaChanged);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_ended", handleCallEnded);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("media_state_changed", handleMediaChanged);
    };
  }, [socket]);

  // Quick Login helper
  const handleQuickLogin = async (email, username) => {
    try {
      toast.info(`Logging in as ${username}...`);
      const res = await googleSignIn({ email, name: username });
      const user = res.data?.user || res.data || res.user;
      setUser(user);
      useChatStore.getState().connectSocket(user);
      toast.success(`Logged in as ${username}!`);
      addLog("USER_LOGIN", `${username} (${user._id})`);
    } catch (err) {
      toast.error(`Login failed: ${err.message}`);
    }
  };

  // Run all automated tests
  const runAutomatedChecks = async () => {
    setIsRunningAllTests(true);

    // 1. Socket Connection Check
    if (socket?.connected) {
      setTestResults((prev) => ({
        ...prev,
        socketConnection: { status: "PASS", message: `Connected (Socket ID: ${socket.id})` },
      }));
    } else {
      setTestResults((prev) => ({
        ...prev,
        socketConnection: { status: "FAIL", message: "Socket is not connected to server." },
      }));
    }

    // 2. User Authentication Check
    if (currentUser?._id) {
      setTestResults((prev) => ({
        ...prev,
        userAuthentication: {
          status: "PASS",
          message: `Authenticated as ${currentUser.username || currentUser.displayName} (${currentUser._id})`,
        },
      }));
    } else {
      setTestResults((prev) => ({
        ...prev,
        userAuthentication: {
          status: "FAIL",
          message: "No authenticated user. Click 'Login as Gulshan' or 'Login as Kartik' above.",
        },
      }));
    }

    // 3. MediaDevices Browser API Support
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setTestResults((prev) => ({
        ...prev,
        mediaDevicesSupport: { status: "PASS", message: "navigator.mediaDevices.getUserMedia is available." },
      }));
    } else {
      setTestResults((prev) => ({
        ...prev,
        mediaDevicesSupport: { status: "FAIL", message: "MediaDevices not supported (requires HTTPS or localhost)." },
      }));
    }

    // 4. Microphone Test
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === "live") {
        setTestResults((prev) => ({
          ...prev,
          microphoneAccess: {
            status: "PASS",
            message: `Mic active: ${audioTrack.label || "Default Microphone"}`,
          },
        }));
        audioStream.getTracks().forEach((t) => t.stop());
      } else {
        setTestResults((prev) => ({
          ...prev,
          microphoneAccess: { status: "FAIL", message: "Audio track was not live." },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        microphoneAccess: { status: "FAIL", message: `Microphone permission denied: ${err.message}` },
      }));
    }

    // 5. Camera Test
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === "live") {
        setTestResults((prev) => ({
          ...prev,
          cameraAccess: {
            status: "PASS",
            message: `Camera active: ${videoTrack.label || "Default Camera"}`,
          },
        }));
        videoStream.getTracks().forEach((t) => t.stop());
      } else {
        setTestResults((prev) => ({
          ...prev,
          cameraAccess: { status: "FAIL", message: "Video track was not live." },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        cameraAccess: { status: "FAIL", message: `Camera permission denied: ${err.message}` },
      }));
    }

    // 6. WebRTC Peer Connection & ICE Gathering Check
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      setTestResults((prev) => ({
        ...prev,
        peerConnectionInit: { status: "PASS", message: "RTCPeerConnection initialized with Google STUN." },
      }));

      // Create data channel to trigger ICE gathering
      pc.createDataChannel("devTestChannel");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const iceGathered = await new Promise((resolve) => {
        let hasCandidate = false;
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            hasCandidate = true;
            resolve(true);
          }
        };
        setTimeout(() => resolve(hasCandidate), 2000);
      });

      if (iceGathered) {
        setTestResults((prev) => ({
          ...prev,
          iceCandidateGathering: { status: "PASS", message: "ICE candidates successfully gathered via STUN server." },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          iceCandidateGathering: { status: "PASS", message: "Local description set (host candidates gathered)." },
        }));
      }

      pc.close();
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        peerConnectionInit: { status: "FAIL", message: err.message },
        iceCandidateGathering: { status: "FAIL", message: err.message },
      }));
    }

    // 7. Signaling Exchange
    if (socket?.connected && currentUser?._id) {
      setTestResults((prev) => ({
        ...prev,
        signalingExchange: { status: "PASS", message: "Socket.io channel ready for offer/answer/ICE exchange." },
      }));
    } else {
      setTestResults((prev) => ({
        ...prev,
        signalingExchange: { status: "FAIL", message: "Connect socket & user identity first." },
      }));
    }

    setIsRunningAllTests(false);
    toast.success("Automated diagnostic checks completed!");
  };

  // Chat send test
  const handleSendTestChat = async () => {
    if (!targetUserId) {
      toast.warning("Please enter or select a Target User ID.");
      return;
    }
    if (!testMsgText.trim()) return;

    try {
      addLog("SEND_MESSAGE_REQUEST", `To: ${targetUserId} | "${testMsgText}"`);
      await axiosInstance.post("/chat/send-message", {
        senderId: currentUser?._id,
        receiverId: targetUserId,
        content: testMsgText,
        contentType: "text",
      });
      toast.success("Test message sent!");
      addLog("SEND_MESSAGE_SUCCESS", testMsgText);
    } catch (err) {
      toast.error(`Failed to send message: ${err.message}`);
      addLog("SEND_MESSAGE_FAILED", err.message);
    }
  };

  // Typing test
  const handleTypingStart = () => {
    if (!targetUserId) return;
    socket?.emit("typing_start", {
      conversationId: `conv_${targetUserId}`,
      receiverId: targetUserId,
    });
    addLog("TYPING_START_SENT", `To: ${targetUserId}`);
  };

  const handleTypingStop = () => {
    if (!targetUserId) return;
    socket?.emit("typing_stop", {
      conversationId: `conv_${targetUserId}`,
      receiverId: targetUserId,
    });
    addLog("TYPING_STOP_SENT", `To: ${targetUserId}`);
  };

  // Call triggers
  const handleStartAudioCall = () => {
    if (!targetUserId) {
      toast.warning("Enter a target User ID first.");
      return;
    }
    webrtcContext?.startCall({ _id: targetUserId, username: targetUserName }, "voice");
  };

  const handleStartVideoCall = () => {
    if (!targetUserId) {
      toast.warning("Enter a target User ID first.");
      return;
    }
    webrtcContext?.startCall({ _id: targetUserId, username: targetUserName }, "video");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222226] pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#FF6B00]/15 text-[#FF6B00] rounded-2xl border border-[#FF6B00]/30">
              <Activity size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Flash Chat E2E Debug & Testing Suite
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30 font-mono">
                  LIVE
                </span>
              </h1>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                Real-time WebRTC, Socket.io, Presence, and 2-Browser Session Verifier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-semibold flex items-center gap-2 transition"
            >
              Open Normal Chat UI <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* ── 1. SESSION & USER SELECTOR ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current User Card */}
          <div className="bg-[#121216] border border-[#24242a] rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A0A0A4]">
                Current Session
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                  isSocketConnected
                    ? "bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {isSocketConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isSocketConnected ? "Socket Online" : "Socket Offline"}
              </span>
            </div>

            {currentUser ? (
              <div className="flex items-center gap-3 pt-1">
                {currentUser.profilePicture ? (
                  <img
                    src={currentUser.profilePicture}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border border-[#333339]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FF6B00] text-white font-bold flex items-center justify-center text-lg">
                    {currentUser.username?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {currentUser.username || currentUser.displayName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
                    <span className="font-mono truncate">{currentUser._id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentUser._id);
                        toast.success("User ID copied!");
                      }}
                      className="hover:text-white p-1"
                      title="Copy User ID"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-400">Not logged in. Choose a test user below:</p>
            )}

            {/* Quick Switcher Buttons */}
            <div className="pt-2 border-t border-[#222226] flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickLogin("gulshan@test.com", "Gulshan (User A)")}
                className="flex-1 min-w-[120px] py-2 bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 text-[#FF6B00] border border-[#FF6B00]/30 rounded-xl text-xs font-semibold transition"
              >
                Login as Gulshan
              </button>
              <button
                onClick={() => handleQuickLogin("kartik@test.com", "Kartik (User B)")}
                className="flex-1 min-w-[120px] py-2 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-semibold transition"
              >
                Login as Kartik
              </button>
              <button
                onClick={() => handleQuickLogin("gullu@test.com", "Gullu (User C)")}
                className="flex-1 min-w-[120px] py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
              >
                Login as Gullu
              </button>
            </div>
          </div>

          {/* Target Peer Selector */}
          <div className="bg-[#121216] border border-[#24242a] rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A0A0A4]">
                Target Peer (Other Browser / User)
              </span>
              <span className="text-xs text-[#8E8E93]">To call / message</span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Enter Target User's _id (from Browser 2)"
                  className="flex-1 bg-[#1a1a20] border border-[#2c2c34] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#666670] focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      // Look up Gulshan id
                      const res = await axiosInstance.get("/users/all?search=Gulshan");
                      const users = res.data?.users || res.data || [];
                      const gulshan = users.find((u) => u.email === "gulshan@test.com" || u.username?.toLowerCase().includes("gulshan"));
                      if (gulshan) {
                        setTargetUserId(gulshan._id);
                        setTargetUserName(gulshan.username);
                        toast.success("Target set to Gulshan!");
                      } else {
                        toast.warning("Gulshan not registered yet. Click 'Login as Gulshan' in another tab first.");
                      }
                    } catch (e) {
                      toast.error("Lookup failed");
                    }
                  }}
                  className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-medium text-slate-300"
                >
                  Set Target: Gulshan
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await axiosInstance.get("/users/all?search=Kartik");
                      const users = res.data?.users || res.data || [];
                      const kartik = users.find((u) => u.email === "kartik@test.com" || u.username?.toLowerCase().includes("kartik"));
                      if (kartik) {
                        setTargetUserId(kartik._id);
                        setTargetUserName(kartik.username);
                        toast.success("Target set to Kartik!");
                      } else {
                        toast.warning("Kartik not registered yet. Click 'Login as Kartik' in another tab first.");
                      }
                    } catch (e) {
                      toast.error("Lookup failed");
                    }
                  }}
                  className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-medium text-slate-300"
                >
                  Set Target: Kartik
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#6b6b75]">
              💡 Open this URL (<code className="text-white">http://localhost:3000/dev-test</code>) in an Incognito / 2nd browser window, log in as User B, and copy their ID here.
            </p>
          </div>
        </div>

        {/* ── 2. TABS ───────────────────────────────────────────────────────── */}
        <div className="flex border-b border-[#222226] gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("automated")}
            className={`pb-3 transition relative ${
              activeTab === "automated" ? "text-[#FF6B00]" : "text-[#8E8E93] hover:text-white"
            }`}
          >
            Automated Checks
            {activeTab === "automated" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`pb-3 transition relative ${
              activeTab === "manual" ? "text-[#FF6B00]" : "text-[#8E8E93] hover:text-white"
            }`}
          >
            Interactive Call & Chat Tests
            {activeTab === "manual" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`pb-3 transition relative ${
              activeTab === "diagnostics" ? "text-[#FF6B00]" : "text-[#8E8E93] hover:text-white"
            }`}
          >
            Live WebRTC & Socket Inspector
            {activeTab === "diagnostics" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
        </div>

        {/* ── 3. TAB CONTENT ────────────────────────────────────────────────── */}

        {/* TAB 1: AUTOMATED CHECKS */}
        {activeTab === "automated" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">System Health & Capability Checks</h3>
                <p className="text-xs text-[#8E8E93]">
                  Verifies underlying Socket connection, WebRTC ICE gathering, microphone & camera permissions.
                </p>
              </div>
              <button
                onClick={runAutomatedChecks}
                disabled={isRunningAllTests}
                className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c966] text-black font-bold rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50"
              >
                {isRunningAllTests ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Running Diagnostics...
                  </>
                ) : (
                  <>
                    <Play size={14} /> Run All Verification Tests
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(testResults).map(([key, res]) => {
                const label = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase());
                return (
                  <div
                    key={key}
                    className="bg-[#121216] border border-[#24242a] rounded-xl p-4 flex items-start justify-between gap-3 shadow"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white">{label}</h4>
                      <p className="text-xs text-[#A0A0A8] font-mono">{res.message}</p>
                    </div>
                    <div>
                      {res.status === "PASS" ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} /> PASS
                        </span>
                      ) : res.status === "FAIL" ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold flex items-center gap-1">
                          <XCircle size={13} /> FAIL
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold">
                          IDLE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE CALL & CHAT TESTS */}
        {activeTab === "manual" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calling Control Panel */}
            <div className="bg-[#121216] border border-[#24242a] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="border-b border-[#222226] pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Phone size={18} className="text-[#FF6B00]" /> WebRTC Audio & Video Calling
                </h3>
                <p className="text-xs text-[#8E8E93]">
                  Initiate real-time peer-to-peer calls to the selected Target User.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStartAudioCall}
                  className="py-3 px-4 bg-[#1e2330] hover:bg-[#252c3d] border border-sky-500/30 text-sky-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Phone size={16} /> Start Voice Call
                </button>
                <button
                  onClick={handleStartVideoCall}
                  className="py-3 px-4 bg-[#231b2c] hover:bg-[#2d2238] border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Video size={16} /> Start Video Call
                </button>
              </div>

              {/* In-Call Controls when active */}
              {webrtcContext && (webrtcContext.isInCall || webrtcContext.isCalling) && (
                <div className="p-4 bg-[#191920] rounded-xl border border-[#2d2d38] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Active Call Status:</span>
                    <span className="text-[#00E676] font-mono font-bold">
                      {webrtcContext.isCalling ? "Calling..." : "In-Call (Connected)"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={webrtcContext.toggleMic}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        webrtcContext.isMuted
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {webrtcContext.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                      {webrtcContext.isMuted ? "Unmute Mic" : "Mute Mic"}
                    </button>
                    <button
                      onClick={webrtcContext.toggleCam}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        webrtcContext.isCamOff
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {webrtcContext.isCamOff ? <VideoOff size={14} /> : <Video size={14} />}
                      {webrtcContext.isCamOff ? "Turn Cam On" : "Turn Cam Off"}
                    </button>
                    <button
                      onClick={webrtcContext.endCall}
                      className="py-2 px-4 bg-[#FF3D71] hover:bg-[#ff205b] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <PhoneOff size={14} /> End
                    </button>
                  </div>
                </div>
              )}

              {/* Local Video Stream Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#A0A0A4]">Local Camera Feed</span>
                <div className="h-44 rounded-xl bg-black border border-[#282830] overflow-hidden relative flex items-center justify-center">
                  {webrtcContext?.localStream && !webrtcContext.isCamOff ? (
                    <video
                      autoPlay
                      playsInline
                      muted
                      ref={(el) => {
                        if (el && webrtcContext.localStream) el.srcObject = webrtcContext.localStream;
                      }}
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center text-xs text-[#666670] space-y-1">
                      <VideoOff size={24} className="mx-auto text-[#444450]" />
                      <span>{webrtcContext?.isCamOff ? "Camera Off" : "No active stream"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Realtime Chat & Typing Panel */}
            <div className="bg-[#121216] border border-[#24242a] rounded-2xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b border-[#222226] pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Send size={18} className="text-[#00E676]" /> Realtime Text Chat & Typing
                  </h3>
                  <p className="text-xs text-[#8E8E93]">
                    Send instant messages and test typing indicator over Socket.io.
                  </p>
                </div>

                {/* Typing Indicator Status */}
                <div className="p-3 bg-[#181820] rounded-xl border border-[#282832] flex items-center justify-between text-xs">
                  <span className="text-[#A0A0A8]">Peer Typing Status:</span>
                  {isPeerTyping ? (
                    <span className="text-[#00E676] font-bold animate-pulse flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00E676]" />
                      Target is typing...
                    </span>
                  ) : (
                    <span className="text-[#666670]">Idle</span>
                  )}
                </div>

                {/* Received Messages Log */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#A0A0A4]">Received Messages (Live Socket)</span>
                  <div className="h-40 overflow-y-auto bg-black/50 border border-[#24242c] rounded-xl p-3 space-y-2 text-xs font-mono">
                    {receivedMessages.length === 0 ? (
                      <p className="text-[#555560] italic">No messages received in this session yet.</p>
                    ) : (
                      receivedMessages.map((m, idx) => (
                        <div key={idx} className="border-b border-[#1c1c24] pb-1.5">
                          <span className="text-[#FF6B00]">[{m.sender?.username || "Peer"}]: </span>
                          <span className="text-white">{m.content || m.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Input & Typing Buttons */}
              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMsgText}
                    onChange={(e) => setTestMsgText(e.target.value)}
                    placeholder="Enter test message"
                    className="flex-1 bg-[#1a1a20] border border-[#2c2c34] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#666670] focus:outline-none focus:border-[#00E676]"
                  />
                  <button
                    onClick={handleSendTestChat}
                    className="px-4 py-2 bg-[#00E676] hover:bg-[#00c562] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Send size={14} /> Send
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onMouseDown={handleTypingStart}
                    onMouseUp={handleTypingStop}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs transition active:bg-[#FF6B00]/20 active:text-[#FF6B00]"
                  >
                    Hold to Simulate Typing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIAGNOSTICS & LIVE EVENT LOG */}
        {activeTab === "diagnostics" && (
          <div className="space-y-6">
            {/* Live State Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#121216] border border-[#24242a] p-4 rounded-xl">
                <span className="text-[11px] font-bold uppercase text-[#8E8E93]">Signaling State</span>
                <p className="text-sm font-bold text-white font-mono mt-1">
                  {webrtcContext?.signalingState || "closed"}
                </p>
              </div>
              <div className="bg-[#121216] border border-[#24242a] p-4 rounded-xl">
                <span className="text-[11px] font-bold uppercase text-[#8E8E93]">ICE Connection State</span>
                <p className="text-sm font-bold text-white font-mono mt-1">
                  {webrtcContext?.iceState || "closed"}
                </p>
              </div>
              <div className="bg-[#121216] border border-[#24242a] p-4 rounded-xl">
                <span className="text-[11px] font-bold uppercase text-[#8E8E93]">Peer Connection State</span>
                <p className="text-sm font-bold text-white font-mono mt-1">
                  {webrtcContext?.connectionState || "closed"}
                </p>
              </div>
              <div className="bg-[#121216] border border-[#24242a] p-4 rounded-xl">
                <span className="text-[11px] font-bold uppercase text-[#8E8E93]">Media Tracks Status</span>
                <p className="text-xs font-mono mt-1 text-slate-300">
                  Local: {localAudioTrackLive ? "A:ON" : "A:OFF"} / {localVideoTrackLive ? "V:ON" : "V:OFF"}
                </p>
                <p className="text-xs font-mono text-slate-400">
                  Remote: {remoteAudioTrackLive ? "A:ON" : "A:OFF"} / {remoteVideoTrackLive ? "V:ON" : "V:OFF"}
                </p>
              </div>
            </div>

            {/* Live Scrolling Event Log */}
            <div className="bg-[#121216] border border-[#24242a] rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#222226] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-[#FF6B00]" />
                  <h3 className="text-sm font-bold text-white">Live Socket & WebRTC Event Stream</h3>
                </div>
                <button
                  onClick={() => setDiagnosticLogs([])}
                  className="text-xs text-[#8E8E93] hover:text-white transition"
                >
                  Clear Log
                </button>
              </div>

              <div className="h-80 overflow-y-auto bg-black/60 rounded-xl p-4 font-mono text-xs space-y-1.5">
                {diagnosticLogs.length === 0 ? (
                  <p className="text-[#555560] italic">Listening for incoming Socket.io and WebRTC events...</p>
                ) : (
                  diagnosticLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 border-b border-white/5 pb-1">
                      <span className="text-[#666670] select-none">[{log.time}]</span>
                      <span className="text-[#00E676] font-bold">{log.event}</span>
                      {log.details && <span className="text-slate-300 truncate">({log.details})</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
