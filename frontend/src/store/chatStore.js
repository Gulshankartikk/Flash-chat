import { create } from "zustand";
import axios from "axios";
import { toast } from "react-toastify";
import {
  initializeSocket,
  disconnectSocket,
  getSocket,
  joinConversation,
  leaveConversation,
  sendMessage as emitSendMessage,
  onReceiveMessage,
  emitTyping,
  emitStopTyping,
  onUserTyping,
  onUserStopTyping,
  emitMessageRead,
  onMessageRead,
  onUserOnline,
  onUserOffline,
  onContactRequestReceived,
  onContactRequestAccepted,
  onContactRequestRejected,
  onConversationCreated,
} from "../services/chat.services";
import {
  getContacts,
  getPendingRequests,
  sendContactRequest as apiSendContactRequest,
  acceptContactRequest as apiAcceptContactRequest,
  rejectContactRequest as apiRejectContactRequest,
  blockContact as apiBlockContact,
  startDirectConversation as apiStartDirectConversation,
} from "../services/contact.service";

const API = process.env.REACT_APP_API_URL;

const api = axios.create({ baseURL: API, withCredentials: true });

const TYPING_AUTO_CLEAR_MS = 5000;
const typingTimeouts = {};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize a message from the backend so the rest of the UI always
 * reads the same field names, regardless of whether the message arrived
 * via REST or Socket.io.
 *
 * Backend uses:  content / contentType / conversation / messageStatus
 * Old frontend:  message / messageType / conversationId / status
 *
 * We keep BOTH so legacy components don't break while you migrate them.
 */
function normalizeMessage(raw) {
  if (!raw) return raw;

  // Resolve the conversation id from whatever shape the backend sends
  const conversationId =
    raw.conversationId ||
    raw.conversation?._id ||
    (typeof raw.conversation === "string" ? raw.conversation : null);

  return {
    ...raw,
    // canonical fields
    content: raw.content ?? raw.message ?? "",
    contentType: raw.contentType ?? raw.messageType ?? "text",
    conversationId,
    messageStatus: raw.messageStatus ?? raw.status ?? "sent",
    // legacy aliases so components using 'message' / 'status' still work
    message: raw.content ?? raw.message ?? "",
    messageType: raw.contentType ?? raw.messageType ?? "text",
    status: raw.messageStatus ?? raw.status ?? "sent",
  };
}

/** Pull the conversation id out of any message shape. */
function getConvId(msg) {
  return (
    msg?.conversationId ||
    msg?.conversation?._id ||
    (typeof msg?.conversation === "string" ? msg.conversation : null)
  );
}

// ─── Store ───────────────────────────────────────────────────────────────────

const useChatStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  currentUser: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  onlineUsers: new Set(),
  lastSeenMap: {},
  typingUsers: {},
  unreadCounts: {},

  replyTo: null,
  selectedMessages: [],
  mediaPreview: null,

  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  isLoadingContacts: false,
  isLoadingRequests: false,
  error: null,
  contactsList: [],
  pendingRequests: [],

  // ── 1. SOCKET connect ──────────────────────────────────────────────────────
  connectSocket: (user) => {
    if (user) set({ currentUser: user });
    initializeSocket(user || get().currentUser);

    // Initialize client-side E2EE keypair
    const u = user || get().currentUser;
    if (u?._id) {
      import("../utils/crypto")
        .then((m) => m.initializeUserE2EE(u._id))
        .catch((err) => console.warn("E2EE key init error:", err));
    }

    // Online / Offline
    onUserOnline(({ userId }) => {
      set((s) => ({
        onlineUsers: new Set([...s.onlineUsers, userId]),
        lastSeenMap: { ...s.lastSeenMap, [userId]: null },
      }));
    });

    onUserOffline(({ userId, lastSeen }) => {
      set((s) => {
        const updated = new Set(s.onlineUsers);
        updated.delete(userId);
        return {
          onlineUsers: updated,
          lastSeenMap: { ...s.lastSeenMap, [userId]: lastSeen },
        };
      });
    });

    // ── Incoming message ── (BUG FIX: conversationId + field normalization)
    onReceiveMessage((raw) => {
      const data = normalizeMessage(raw);
      const incomingConvId = getConvId(data);

      const { activeConversation, messages, unreadCounts, conversations } = get();

      // Guard against duplicate delivery (socket + REST race)
      const alreadyHave = messages.some((m) => m._id === data._id);

      if (activeConversation?._id === incomingConvId) {
        if (!alreadyHave) {
          set({ messages: [...messages, data] });
        }
        // Send read receipt for messages that aren't ours
        if (!data.isMine) {
          emitMessageRead({
            messageId: data._id,
            conversationId: incomingConvId,
            senderId: data.sender?._id || data.sender || data.senderId,
            status: "read",
          });
        }
      } else {
        // Background conversation → bump unread badge
        if (incomingConvId) {
          set({
            unreadCounts: {
              ...unreadCounts,
              [incomingConvId]: (unreadCounts[incomingConvId] || 0) + 1,
            },
          });
        }
      }

      // Reorder conversations: latest on top
      if (incomingConvId) {
        const updatedConvs = conversations
          .map((c) =>
            c._id === incomingConvId
              ? { ...c, lastMessage: data, updatedAt: data.createdAt }
              : c
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        set({ conversations: updatedConvs });
      }
    });

    // Read receipts: ✓ → ✓✓ → ✓✓(blue)
    onMessageRead(({ messageId, status }) => {
      set((s) => ({
        messages: s.messages.map((m) =>
          m._id === messageId
            ? { ...m, status, messageStatus: status }
            : m
        ),
      }));
    });

    // Typing indicators
    onUserTyping(({ conversationId, userId }) => {
      const key = `${conversationId}_${userId}`;
      clearTimeout(typingTimeouts[key]);
      typingTimeouts[key] = setTimeout(() => {
        get().clearTypingUser(conversationId, userId);
      }, TYPING_AUTO_CLEAR_MS);

      set((s) => {
        const prev = s.typingUsers[conversationId] || [];
        if (prev.includes(userId)) return {};
        return {
          typingUsers: { ...s.typingUsers, [conversationId]: [...prev, userId] },
        };
      });
    });

    onUserStopTyping(({ conversationId, userId }) => {
      const key = `${conversationId}_${userId}`;
      clearTimeout(typingTimeouts[key]);
      get().clearTypingUser(conversationId, userId);
    });

    // Socket-pushed edits / pins
    const s = getSocket();
    if (s) {
      s.off("message_edited");
      s.on("message_edited", ({ messageId, content }) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m._id === messageId
              ? { ...m, content, message: content, isEdited: true }
              : m
          ),
        }));
      });

      s.off("message_deleted");
      s.on("message_deleted", ({ messageId, deleteForEveryone }) => {
        if (deleteForEveryone) {
          set((state) => ({
            messages: state.messages.map((m) =>
              m._id === messageId
                ? { ...m, content: "", message: "", isDeletedForEveryone: true }
                : m
            ),
          }));
        } else {
          // "delete for me" from another session/device
          set((state) => ({
            messages: state.messages.filter((m) => m._id !== messageId),
          }));
        }
      });

      s.off("message_pinned");
      s.on("message_pinned", ({ messageId, isPinned, conversationId }) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m._id === messageId) return { ...m, isPinned };
            const mConvId = getConvId(m);
            if (mConvId === conversationId) return { ...m, isPinned: false };
            return m;
          }),
        }));
      });

      s.off("message_reaction");
      s.on("message_reaction", ({ messageId, userId, emoji, action }) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m._id !== messageId) return m;
            const reactions = m.reactions || [];
            if (action === "removed") {
              return { ...m, reactions: reactions.filter((r) => r.userId !== userId) };
            }
            const updated = reactions.filter((r) => r.userId !== userId);
            return { ...m, reactions: [...updated, { userId, emoji }] };
          }),
        }));
      });

      s.off("group_updated");
      s.on("group_updated", (updatedGroup) => {
        const { conversations, activeConversation } = get();
        const myId = get().currentUser?._id;
        const isParticipant = updatedGroup.participants.some(
          (p) => String(p._id || p) === String(myId)
        );

        if (!isParticipant) {
          // We were removed from the group
          set({
            conversations: conversations.filter((c) => c._id !== updatedGroup._id),
          });
          if (activeConversation?._id === updatedGroup._id) {
            set({ activeConversation: null, messages: [] });
            toast.info(`You have been removed from the group "${updatedGroup.groupName}"`);
          }
        } else {
          // Group metadata or participants updated
          const exists = conversations.some((c) => c._id === updatedGroup._id);
          let updatedList;
          if (exists) {
            updatedList = conversations.map((c) => (c._id === updatedGroup._id ? updatedGroup : c));
          } else {
            updatedList = [updatedGroup, ...conversations];
          }
          set({ conversations: updatedList });

          if (activeConversation?._id === updatedGroup._id) {
            set({ activeConversation: updatedGroup });
          }
        }
      });
    }

    onContactRequestReceived((populatedContact) => {
      set((s) => ({
        pendingRequests: [populatedContact, ...s.pendingRequests],
      }));
    });

    onContactRequestAccepted((populatedContact) => {
      const currentUserId = get().currentUser?._id;
      if (!currentUserId) return;
      
      const isMeSender = String(populatedContact.sender._id) === String(currentUserId);
      const otherUser = isMeSender ? populatedContact.receiver : populatedContact.sender;

      set((s) => {
        const updatedRequests = s.pendingRequests.filter(
          (r) => String(r._id) !== String(populatedContact._id)
        );
        
        const alreadyExists = s.contactsList.some(
          (c) => String(c.user?._id || c.user) === String(otherUser._id)
        );
        
        if (alreadyExists) {
          return { pendingRequests: updatedRequests };
        }

        const newContactRecord = {
          _id: populatedContact._id,
          user: otherUser,
          conversation: null,
          status: "accepted",
          createdAt: populatedContact.createdAt,
          updatedAt: populatedContact.updatedAt,
        };

        return {
          contactsList: [newContactRecord, ...s.contactsList],
          pendingRequests: updatedRequests,
        };
      });
    });

    onContactRequestRejected((populatedContact) => {
      set((s) => ({
        pendingRequests: s.pendingRequests.filter(
          (r) => String(r._id) !== String(populatedContact._id)
        ),
      }));
    });

    onConversationCreated((newConvo) => {
      set((s) => {
        const already = s.conversations.some((c) => c._id === newConvo._id);
        if (already) return {};
        return {
          conversations: [newConvo, ...s.conversations],
        };
      });
    });
  },

  clearTypingUser: (conversationId, userId) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [conversationId]: (s.typingUsers[conversationId] || []).filter(
          (id) => id !== userId
        ),
      },
    }));
  },

  // ── 2. SOCKET disconnect ───────────────────────────────────────────────────
  disconnectSocket: () => {
    disconnectSocket();
    Object.values(typingTimeouts).forEach(clearTimeout);
    set({ onlineUsers: new Set(), typingUsers: {}, lastSeenMap: {} });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  // ── 3. FETCH CONVERSATIONS ─────────────────────────────────────────────────
  fetchConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const { data } = await api.get("/api/chat/conversation");
      const list = data?.data || data;
      const sorted = [...list].sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );

      const unreadCounts = {};
      sorted.forEach((c) => {
        if (typeof c.unreadCount === "number") unreadCounts[c._id] = c.unreadCount;
      });

      set((s) => ({
        conversations: sorted,
        unreadCounts: { ...unreadCounts, ...s.unreadCounts },
        isLoadingConversations: false,
      }));
    } catch (err) {
      set({
        error: err?.response?.data?.message || "Failed to load conversations",
        isLoadingConversations: false,
      });
    }
  },

  // ── 4. OPEN CONVERSATION ───────────────────────────────────────────────────
  openConversation: async (conversation) => {
    const { activeConversation } = get();
    if (activeConversation?._id === conversation._id) return;

    if (activeConversation?._id && !activeConversation.isDraft) {
      leaveConversation(activeConversation._id);
    }

    set({
      activeConversation: conversation,
      messages: [],
      replyTo: null,
      selectedMessages: [],
      isLoadingMessages: !conversation.isDraft,
      error: null,
    });

    if (conversation.isDraft) return;

    joinConversation(conversation._id);

    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [conversation._id]: 0 },
    }));

    try {
      const { data } = await api.get(
        `/api/chat/conversation/${conversation._id}/message`
      );
      const list = (data?.data || data).map(normalizeMessage);
      set({ messages: list, isLoadingMessages: false });

      list
        .filter((m) => m.messageStatus !== "seen" && !m.isMine)
        .forEach((m) =>
          emitMessageRead({ messageIds: [m._id], senderId: m.sender?._id || m.sender })
        );
    } catch (err) {
      set({
        error: err?.response?.data?.message || "Failed to load messages",
        isLoadingMessages: false,
      });
    }
  },

  // ── 5. CLOSE CONVERSATION ──────────────────────────────────────────────────
  closeConversation: () => {
    const { activeConversation } = get();
    if (activeConversation?._id && !activeConversation.isDraft) {
      leaveConversation(activeConversation._id);
    }
    set({ activeConversation: null, messages: [], replyTo: null, selectedMessages: [] });
  },

  // ── 6. SEND MESSAGE ────────────────────────────────────────────────────────
  sendMessage: async ({
    receiverId,
    message,
    messageType = "text",
    mediaFile = null,
  }) => {
    const { activeConversation, messages, replyTo } = get();
    if (!activeConversation) return;

    set({ isSendingMessage: true });

    const tempId = `temp_${Date.now()}`;
    const objectUrl = mediaFile ? URL.createObjectURL(mediaFile) : null;

    // ── BUG FIX: use 'content' + 'contentType' to match backend field names ──
    const tempMsg = normalizeMessage({
      _id: tempId,
      conversation: activeConversation._id,
      conversationId: activeConversation._id,
      sender: get().currentUser,
      receiver: receiverId,
      content: message,           // ✅ was 'message'
      contentType: messageType,   // ✅ was 'messageType'
      mediaUrl: objectUrl,
      imageOrVideoUrl: objectUrl,
      replyTo: replyTo || null,
      messageStatus: "sending",   // ✅ was 'status'
      isMine: true,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    });

    set({ messages: [...messages, tempMsg], replyTo: null });

    const wasDraft = !!activeConversation.isDraft;

    try {
      let savedMessage;
      const isAIBot = activeConversation.participants?.some(p => p.isAIBot || p.email === "ai@flashchat.com");
      const shouldEncrypt = messageType === "text" && activeConversation.conversationType === "private" && !isAIBot;
      
      let messageToSend = message;
      if (shouldEncrypt) {
        const { encryptText } = await import("../utils/crypto");
        messageToSend = await encryptText(
          message,
          activeConversation._id,
          receiverId,
          get().currentUser?._id
        );
      }

      const isGroup = activeConversation.conversationType === "group";

      if (mediaFile) {
        const formData = new FormData();
        formData.append("file", mediaFile);
        formData.append("messageType", messageType);
        if (isGroup) {
          formData.append("conversationId", activeConversation._id);
        } else {
          formData.append("receiverId", receiverId);
        }
        if (replyTo) formData.append("replyToId", replyTo._id);
        formData.append("senderId", get().currentUser?._id || "");

        const { data: mediaData } = await api.post(
          `/api/chat/send-message`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        savedMessage = normalizeMessage(mediaData?.data || mediaData);
      } else {
        if (!wasDraft) {
          emitSendMessage({
            conversationId: activeConversation._id,
            receiverId: isGroup ? undefined : receiverId,
            message: messageToSend,
            messageType,
            replyToId: replyTo?._id || null,
          });
        }

        const { data: msgData } = await api.post(`/api/chat/send-message`, {
          senderId: get().currentUser?._id,
          receiverId: isGroup ? undefined : receiverId,
          conversationId: isGroup ? activeConversation._id : undefined,
          content: messageToSend,
          contentType: messageType,
        });
        savedMessage = normalizeMessage(msgData?.data || msgData);
      }

      if (objectUrl) URL.revokeObjectURL(objectUrl);

      const realConversationId = getConvId(savedMessage) || activeConversation._id;

      // Replace optimistic → real
      set((s) => ({
        messages: s.messages.map((m) => (m._id === tempId ? savedMessage : m)),
        isSendingMessage: false,
      }));

      if (wasDraft) {
        const realConversation = {
          ...activeConversation,
          _id: realConversationId,
          isDraft: false,
          lastMessage: savedMessage,
          updatedAt: savedMessage.createdAt,
        };
        joinConversation(realConversationId);
        set((s) => ({
          activeConversation: realConversation,
          conversations: [
            realConversation,
            ...s.conversations.filter((c) => c._id !== realConversationId),
          ],
        }));
      } else {
        set((s) => ({
          conversations: s.conversations
            .map((c) =>
              c._id === activeConversation._id
                ? { ...c, lastMessage: savedMessage, updatedAt: savedMessage.createdAt }
                : c
            )
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
        }));
      }
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      set((s) => ({
        messages: s.messages.map((m) =>
          m._id === tempId ? { ...m, messageStatus: "failed", status: "failed" } : m
        ),
        isSendingMessage: false,
        error: err?.response?.data?.message || "Message failed",
      }));
    }
  },

  // Retry a failed message
  retryMessage: (failedMsg) => {
    set((s) => ({ messages: s.messages.filter((m) => m._id !== failedMsg._id) }));
    get().sendMessage({
      receiverId: failedMsg.receiver?._id || failedMsg.receiver || failedMsg.receiverId,
      message: failedMsg.content || failedMsg.message,
      messageType: failedMsg.contentType || failedMsg.messageType,
    });
  },

  // ── 7. REPLY ───────────────────────────────────────────────────────────────
  setReplyTo: (message) => set({ replyTo: message }),
  clearReplyTo: () => set({ replyTo: null }),

  // ── 8. DELETE MESSAGE ──────────────────────────────────────────────────────
  deleteMessage: async (messageId, deleteFor = "me") => {
    // Optimistic update
    if (deleteFor === "everyone") {
      set((s) => ({
        messages: s.messages.map((m) =>
          m._id === messageId
            ? { ...m, content: "", message: "", isDeletedForEveryone: true }
            : m
        ),
      }));
    } else {
      set((s) => ({ messages: s.messages.filter((m) => m._id !== messageId) }));
    }

    try {
      await api.delete(`/api/chat/message/${messageId}`, {
        data: { deleteForEveryone: deleteFor === "everyone" },
      });
    } catch (err) {
      // Re-fetch messages to restore correct state on failure
      const { activeConversation } = get();
      if (activeConversation?._id) {
        const { data } = await api.get(
          `/api/chat/conversation/${activeConversation._id}/message`
        ).catch(() => ({ data: null }));
        if (data) set({ messages: (data?.data || data).map(normalizeMessage) });
      }
      set({ error: err?.response?.data?.message || "Delete failed" });
    }
  },

  // ── 9. EMOJI REACTIONS ─────────────────────────────────────────────────────
  reactToMessage: async (messageId, emoji) => {
    const { currentUser, messages } = get();
    const prevMessages = messages;

    set((s) => ({
      messages: s.messages.map((m) => {
        if (m._id !== messageId) return m;
        const existing = m.reactions || [];
        const mine = existing.find((r) => r.userId === currentUser?._id);
        let reactions;
        if (mine && mine.emoji === emoji) {
          reactions = existing.filter((r) => r.userId !== currentUser?._id);
        } else {
          reactions = [
            ...existing.filter((r) => r.userId !== currentUser?._id),
            { emoji, userId: currentUser?._id, userName: currentUser?.username },
          ];
        }
        return { ...m, reactions };
      }),
    }));

    try {
      const { data } = await api.post(`/api/chat/message/${messageId}/react`, { emoji });
      const saved = data?.data || data;
      set((s) => ({
        messages: s.messages.map((m) => (m._id === messageId ? normalizeMessage(saved) : m)),
      }));
    } catch (err) {
      set({ messages: prevMessages, error: "Reaction failed" });
    }
  },

  // ── 10. MULTI-SELECT ───────────────────────────────────────────────────────
  toggleSelectMessage: (messageId) => {
    set((s) => {
      const already = s.selectedMessages.includes(messageId);
      return {
        selectedMessages: already
          ? s.selectedMessages.filter((id) => id !== messageId)
          : [...s.selectedMessages, messageId],
      };
    });
  },

  clearSelection: () => set({ selectedMessages: [] }),

  deleteSelectedMessages: async (deleteFor = "me") => {
    const { selectedMessages } = get();
    try {
      await api.post("/api/chat/message/bulk-delete", {
        messageIds: selectedMessages,
        deleteFor,
      });
      if (deleteFor === "everyone") {
        set((s) => ({
          messages: s.messages.map((m) =>
            selectedMessages.includes(m._id)
              ? { ...m, content: "", message: "", isDeletedForEveryone: true }
              : m
          ),
          selectedMessages: [],
        }));
      } else {
        set((s) => ({
          messages: s.messages.filter((m) => !selectedMessages.includes(m._id)),
          selectedMessages: [],
        }));
      }
    } catch (err) {
      set({ error: "Bulk delete failed" });
    }
  },

  // ── 11. EDIT MESSAGE ───────────────────────────────────────────────────────
  editMessage: async (messageId, newContent) => {
    // Optimistic update
    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === messageId
          ? { ...m, content: newContent, message: newContent, isEdited: true }
          : m
      ),
    }));

    try {
      const { data } = await api.put(`/api/chat/message/${messageId}`, { content: newContent });
      const updated = normalizeMessage(data?.data || data);
      set((s) => ({
        messages: s.messages.map((m) => (m._id === messageId ? updated : m)),
      }));
    } catch (err) {
      set({ error: "Edit message failed" });
      throw err;
    }
  },

  // ── 12. PIN MESSAGE ────────────────────────────────────────────────────────
  pinMessage: async (messageId) => {
    try {
      const { data } = await api.put(`/api/chat/message/${messageId}/pin`);
      const updated = normalizeMessage(data?.data || data);
      set((s) => ({
        messages: s.messages.map((m) => {
          if (m._id === messageId) return updated;
          return { ...m, isPinned: false };
        }),
      }));
    } catch (err) {
      set({ error: "Pin message failed" });
      throw err;
    }
  },

  // ── 13. FORWARD MESSAGE ────────────────────────────────────────────────────
  forwardMessage: async (message, targetUserIds) => {
    const promises = targetUserIds.map((receiverId) =>
      api.post(`/api/chat/send-message`, {
        senderId: get().currentUser?._id,
        receiverId,
        content: message.content || message.message || "",
        contentType: message.contentType || message.messageType || "text",
        imageOrVideoUrl: message.imageOrVideoUrl || null,
      })
    );
    try {
      await Promise.all(promises);
      get().fetchConversations();
    } catch (err) {
      set({ error: "Forward message failed" });
      throw err;
    }
  },

  // ── 14. TYPING ─────────────────────────────────────────────────────────────
  startTyping: (receiverId) => {
    const { activeConversation } = get();
    if (activeConversation && !activeConversation.isDraft) {
      emitTyping({ conversationId: activeConversation._id, receiverId });
    }
  },

  stopTyping: (receiverId) => {
    const { activeConversation } = get();
    if (activeConversation && !activeConversation.isDraft) {
      emitStopTyping({ conversationId: activeConversation._id, receiverId });
    }
  },

  // ── 15. MEDIA PREVIEW ──────────────────────────────────────────────────────
  openMediaPreview: (media) => set({ mediaPreview: media }),
  closeMediaPreview: () => set({ mediaPreview: null }),

  // ── 16. CREATE DRAFT CONVERSATION ──────────────────────────────────────────
  createConversation: (participant) => {
    const existing = get().conversations.find(
      (c) => !c.isDraft && c.participants?.some((p) => p._id === participant._id)
    );
    if (existing) {
      get().openConversation(existing);
      return existing;
    }

    const draftConversation = {
      _id: `draft_${participant._id}`,
      participants: [participant],
      isDraft: true,
      lastMessage: null,
      updatedAt: new Date().toISOString(),
    };

    get().openConversation(draftConversation);
    return draftConversation;
  },

  // ── 17. HELPERS ────────────────────────────────────────────────────────────
  getUserStatus: (userId) => {
    const { onlineUsers, lastSeenMap } = get();
    if (onlineUsers.has(userId)) return "online";
    const lastSeen = lastSeenMap[userId];
    if (!lastSeen) return "offline";
    const diff = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "last seen just now";
    if (mins < 60) return `last seen ${mins}m ago`;
    if (hours < 24) return `last seen ${hours}h ago`;
    return `last seen ${days}d ago`;
  },

  isUserOnline: (userId) => get().onlineUsers.has(userId),
  getTypingUsers: (conversationId) => get().typingUsers[conversationId] || [],
  getUnreadCount: (conversationId) => get().unreadCounts[conversationId] || 0,
  getTotalUnread: () => Object.values(get().unreadCounts).reduce((s, n) => s + n, 0),
  clearError: () => set({ error: null }),

  // ── 18. CONTACTS & REQUESTS ────────────────────────────────────────────────
  fetchContacts: async () => {
    set({ isLoadingContacts: true });
    try {
      const res = await getContacts();
      set({ contactsList: res.data || [], isLoadingContacts: false });
    } catch (err) {
      set({ error: err.message || "Failed to load contacts", isLoadingContacts: false });
    }
  },

  fetchPendingRequests: async () => {
    set({ isLoadingRequests: true });
    try {
      const res = await getPendingRequests();
      set({ pendingRequests: res.data || [], isLoadingRequests: false });
    } catch (err) {
      set({ error: err.message || "Failed to load requests", isLoadingRequests: false });
    }
  },

  sendContactRequest: async (userId) => {
    try {
      const res = await apiSendContactRequest(userId);
      toast.success("Contact request sent successfully!");
      return res.data;
    } catch (err) {
      toast.error(err.message || "Failed to send contact request");
      throw err;
    }
  },

  acceptContactRequest: async (contactId) => {
    try {
      const res = await apiAcceptContactRequest(contactId);
      toast.success("Contact request accepted!");
      set((s) => {
        const acceptedRequest = s.pendingRequests.find(r => String(r._id) === String(contactId));
        const otherUser = acceptedRequest?.sender;
        
        const updatedRequests = s.pendingRequests.filter(
          (r) => String(r._id) !== String(contactId)
        );
        
        if (!otherUser) {
          return { pendingRequests: updatedRequests };
        }

        const newContactRecord = {
          _id: contactId,
          user: otherUser,
          conversation: null,
          status: "accepted",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          contactsList: [newContactRecord, ...s.contactsList],
          pendingRequests: updatedRequests,
        };
      });
      return res.data;
    } catch (err) {
      toast.error(err.message || "Failed to accept contact request");
      throw err;
    }
  },

  rejectContactRequest: async (contactId) => {
    try {
      await apiRejectContactRequest(contactId);
      toast.success("Contact request rejected");
      set((s) => ({
        pendingRequests: s.pendingRequests.filter(
          (r) => String(r._id) !== String(contactId)
        ),
      }));
    } catch (err) {
      toast.error(err.message || "Failed to reject request");
      throw err;
    }
  },

  blockContact: async (contactId) => {
    try {
      await apiBlockContact(contactId);
      toast.success("Contact blocked successfully");
      set((s) => ({
        contactsList: s.contactsList.filter(c => String(c._id) !== String(contactId))
      }));
    } catch (err) {
      toast.error(err.message || "Failed to block contact");
      throw err;
    }
  },

  startDirectConversation: async (userId) => {
    try {
      const { data: conversation } = await apiStartDirectConversation(userId);
      set((s) => {
        const already = s.conversations.some((c) => c._id === conversation._id);
        const updatedConvs = already
          ? s.conversations
          : [conversation, ...s.conversations];
        return {
          conversations: updatedConvs,
        };
      });
      get().openConversation(conversation);
      return conversation;
    } catch (err) {
      toast.error(err.message || "Failed to start direct conversation");
      throw err;
    }
  },
}));

export default useChatStore;