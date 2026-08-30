import { io } from "socket.io-client";
import { toast } from "react-toastify";

// ─── Module-level state ───────────────────────────────────────────────────────
let socket = null;

// Callbacks stored at module level so the unified listeners can always call
// the latest version even if the store re-registers them after a reconnect.
const callbacks = {
  typingStart: null,
  typingStop: null,
  userOnline: null,
  userOffline: null,
  receiveMessage: null,
  messageRead: null,
  contactRequestReceived: null,
  contactRequestAccepted: null,
  contactRequestRejected: null,
  conversationCreated: null,
};

// ─── Internal: attach all persistent listeners ───────────────────────────────
// Called once on connect and again after every reconnect so listeners survive
// network drops without stacking duplicates.

function attachPersistentListeners(user) {
  if (!socket) return;

  // ── user_typing → split into start / stop ──
  socket.off("user_typing");
  socket.on("user_typing", (data) => {
    if (data.isTyping) callbacks.typingStart?.(data);
    else callbacks.typingStop?.(data);
  });

  // ── user_status → split into online / offline ──
  socket.off("user_status");
  socket.on("user_status", (data) => {
    if (data.isOnline) callbacks.userOnline?.(data);
    else callbacks.userOffline?.(data);
  });

  // ── receive_message ──
  socket.off("receive_message");
  socket.on("receive_message", (data) => {
    callbacks.receiveMessage?.(data);
  });

  // ── message_status_update (read receipts) ──
  socket.off("message_status_update");
  socket.on("message_status_update", (data) => {
    callbacks.messageRead?.(data);
  });

  // ── contact_request_received ──
  socket.off("contact_request_received");
  socket.on("contact_request_received", (data) => {
    callbacks.contactRequestReceived?.(data);
  });

  // ── contact_request_accepted ──
  socket.off("contact_request_accepted");
  socket.on("contact_request_accepted", (data) => {
    callbacks.contactRequestAccepted?.(data);
  });

  // ── contact_request_rejected ──
  socket.off("contact_request_rejected");
  socket.on("contact_request_rejected", (data) => {
    callbacks.contactRequestRejected?.(data);
  });

  // ── conversation_created ──
  socket.off("conversation_created");
  socket.on("conversation_created", (data) => {
    callbacks.conversationCreated?.(data);
  });

  // Re-announce presence so the backend doesn't think we went offline
  if (user?._id) socket.emit("user_connected", user._id);
}

// ─── Initialize ──────────────────────────────────────────────────────────────
export const initializeSocket = (user) => {
  // If socket already exists and belongs to the same user, reuse it
  if (socket) {
    if (socket.userId === user?._id) {
      if (socket.connected && user?._id) {
        socket.emit("user_connected", user._id);
      }
      return socket;
    }
    // User has changed — disconnect the old socket
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const BACKEND_URL = new URL(process.env.REACT_APP_API_URL).origin;

  socket = io(BACKEND_URL, {
    withCredentials: true,
    // Prefer WebSocket; fall back to polling only if WS is blocked.
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000, // cap at 10 s (exponential back-off)
    timeout: 20000,
    path: "/socket.io",
  });

  socket.userId = user?._id;

  socket.on("connect", () => {
    console.log("[socket] connected:", socket.id);
    toast.dismiss("socket-status");
    attachPersistentListeners(user);
  });

  // Re-attach all listeners after every reconnect so nothing is lost
  socket.io.on("reconnect", (attempt) => {
    console.log(`[socket] reconnected after ${attempt} attempt(s)`);
    toast.success("Reconnected to chat server!", { toastId: "socket-status", autoClose: 3000 });
    attachPersistentListeners(user);
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error:", err.message);
    toast.warning("Connection lost. Reconnecting to chat server...", {
      toastId: "socket-status",
      autoClose: false,
      closeOnClick: false,
      draggable: false,
    });
  });

  socket.io.on("reconnect_failed", () => {
    toast.error("Could not reconnect to chat server. Please refresh the page.", {
      toastId: "socket-status",
      autoClose: false,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
    // "io server disconnect" = server kicked us intentionally; don't auto-reconnect
    if (reason === "io server disconnect") socket.connect();
  });

  return socket;
};

export const getSocket = () => socket;

// ─── Send message ─────────────────────────────────────────────────────────────
export const sendMessage = (messageData) => {
  if (!socket?.connected) {
    console.warn("[socket] sendMessage called but socket is not connected");
    return;
  }
  socket.emit("send_message", messageData);
};

// ─── Receive message ──────────────────────────────────────────────────────────
// Store the callback; the actual listener is attached in attachPersistentListeners
// so it is never duplicated across reconnects.
export const onReceiveMessage = (callback) => {
  callbacks.receiveMessage = callback;
  // If the socket is already connected, attach immediately
  if (socket?.connected) {
    socket.off("receive_message");
    socket.on("receive_message", (data) => callbacks.receiveMessage?.(data));
  }
};

// ─── Typing ───────────────────────────────────────────────────────────────────
export const emitTyping = ({ conversationId, receiverId }) => {
  socket?.emit("typing_start", { conversationId, receiverId });
};

export const emitStopTyping = ({ conversationId, receiverId }) => {
  socket?.emit("typing_stop", { conversationId, receiverId });
};

export const onUserTyping = (callback) => {
  callbacks.typingStart = callback;
};

export const onUserStopTyping = (callback) => {
  callbacks.typingStop = callback;
};

// ─── Read receipts ────────────────────────────────────────────────────────────
// Backend expects: { messageIds: [], senderId }
// Backend emits:  "message_status_update" { messageId, messageStatus }
export const emitMessageRead = ({ messageIds, senderId, messageId, conversationId, status }) => {
  if (!socket?.connected) return;

  // Support both single-id (messageId) and bulk (messageIds) call shapes
  const ids = messageIds || (messageId ? [messageId] : []);
  if (ids.length === 0) return;

  socket.emit("message_read", { messageIds: ids, senderId, conversationId, status });
};

export const onMessageRead = (callback) => {
  callbacks.messageRead = callback;
  if (socket?.connected) {
    socket.off("message_status_update");
    socket.on("message_status_update", (data) => callbacks.messageRead?.(data));
  }
};

// ─── Online / Offline ─────────────────────────────────────────────────────────
export const onUserOnline = (callback) => {
  callbacks.userOnline = callback;
};

export const onUserOffline = (callback) => {
  callbacks.userOffline = callback;
};

// ─── Reactions ────────────────────────────────────────────────────────────────
export const emitReaction = ({ messageId, emoji, reactionUserId }) => {
  socket?.emit("add_reaction", { messageId, emoji, reactionUserId });
};

export const onReactionUpdate = (callback) => {
  if (!socket) return;
  socket.off("reaction_update");
  socket.on("reaction_update", callback);
};

// ─── User status check (one-time query) ──────────────────────────────────────
export const getUserStatus = (userId, callback) => {
  socket?.emit("get_user_status", userId, callback);
};

// ─── Join / Leave conversation room ──────────────────────────────────────────
export const joinConversation = (conversationId) => {
  if (!conversationId) return;
  socket?.emit("join_conversation", conversationId);
};

export const leaveConversation = (conversationId) => {
  if (!conversationId) return;
  socket?.emit("leave_conversation", conversationId);
};

export const onContactRequestReceived = (callback) => {
  callbacks.contactRequestReceived = callback;
};

export const onContactRequestAccepted = (callback) => {
  callbacks.contactRequestAccepted = callback;
};

export const onContactRequestRejected = (callback) => {
  callbacks.contactRequestRejected = callback;
};

export const onConversationCreated = (callback) => {
  callbacks.conversationCreated = callback;
};

// ─── Disconnect ───────────────────────────────────────────────────────────────
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  // Clear all stored callbacks so nothing fires after logout
  Object.keys(callbacks).forEach((k) => (callbacks[k] = null));
};