import { create } from 'zustand';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuthStore } from './useAuthStore';

export const useChatStore = create((set, get) => ({
  conversations: [],
  chats: [], // Backwards compatibility alias
  activeConversation: null,
  activeChat: null, // Backwards compatibility alias
  messages: [],
  messagesByConv: {},
  nextCursor: null,
  hasMore: false,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  onlineUsers: new Set(),
  typingUsers: {}, // convId -> Map/Array of user info
  starredMessages: [],
  isSearchingMessages: false,
  searchResults: [],

  setOnlineUsers: (users) => set({ onlineUsers: new Set(users) }),

  /**
   * Fetch all conversations for current user
   */
  fetchConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const res = await api.get('/chats');
      const convs = res.data.conversations || [];
      set({
        conversations: convs,
        chats: convs,
        isLoadingConversations: false
      });
      return convs;
    } catch (err) {
      console.error('Failed to fetch conversations:', err.message);
      set({ isLoadingConversations: false });
      return [];
    }
  },

  // Alias
  fetchChats: async () => get().fetchConversations(),

  /**
   * Start or fetch a direct conversation with a target user
   */
  startDirectConversation: async (targetUserId) => {
    try {
      const res = await api.post('/chats/direct', { userId: targetUserId });
      const conv = res.data.conversation;

      // Add to conversation list if not present
      set((state) => {
        const exists = state.conversations.some((c) => String(c._id) === String(conv._id));
        const updated = exists
          ? state.conversations.map((c) => (String(c._id) === String(conv._id) ? conv : c))
          : [conv, ...state.conversations];
        return { conversations: updated, chats: updated };
      });

      await get().selectConversation(conv);
      return conv;
    } catch (err) {
      console.error('Failed to start direct conversation:', err.message);
      throw err;
    }
  },

  /**
   * Create a new group conversation
   */
  createGroup: async ({ name, memberIds, avatar, description }) => {
    try {
      const res = await api.post('/chats/group', { name, memberIds, avatar, description });
      const conv = res.data.conversation;

      set((state) => ({
        conversations: [conv, ...state.conversations],
        chats: [conv, ...state.chats]
      }));

      await get().selectConversation(conv);
      return conv;
    } catch (err) {
      console.error('Failed to create group:', err.message);
      throw err;
    }
  },

  /**
   * Select active conversation and load messages
   */
  selectConversation: async (convOrId) => {
    const convId = typeof convOrId === 'object' ? convOrId?._id : convOrId;
    if (!convId) {
      set({ activeConversation: null, activeChat: null, messages: [] });
      return;
    }

    let conversation =
      typeof convOrId === 'object'
        ? convOrId
        : get().conversations.find((c) => String(c._id) === String(convId));

    if (!conversation) {
      try {
        const res = await api.get(`/chats/${convId}`);
        conversation = res.data.conversation;
      } catch (err) {
        console.error('Failed to load conversation details:', err.message);
      }
    }

    set({
      activeConversation: conversation,
      activeChat: conversation,
      messages: get().messagesByConv[convId] || [],
      nextCursor: null,
      hasMore: false
    });

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('message:read', { conversationId: convId });
    }

    // Reset unread count locally
    set((state) => {
      const updatedConvs = state.conversations.map((c) =>
        String(c._id) === String(convId) ? { ...c, unreadCount: 0 } : c
      );
      return { conversations: updatedConvs, chats: updatedConvs };
    });

    // Fetch latest messages from API
    await get().fetchMessages(convId);
  },

  // Alias
  setActiveChat: async (chat) => get().selectConversation(chat),

  /**
   * Fetch messages with cursor pagination
   */
  fetchMessages: async (convId, cursor = null) => {
    const targetId = convId || get().activeConversation?._id;
    if (!targetId) return;

    set({ isLoadingMessages: true });
    try {
      const url = cursor
        ? `/chats/${targetId}/messages?cursor=${encodeURIComponent(cursor)}&limit=30`
        : `/chats/${targetId}/messages?limit=30`;

      const res = await api.get(url);
      const { messages = [], nextCursor = null } = res.data;

      set((state) => {
        const existing = cursor ? state.messagesByConv[targetId] || [] : [];
        const combined = cursor ? [...messages, ...existing] : messages;

        return {
          messagesByConv: { ...state.messagesByConv, [targetId]: combined },
          messages: String(state.activeConversation?._id) === String(targetId) ? combined : state.messages,
          nextCursor,
          hasMore: !!nextCursor,
          isLoadingMessages: false
        };
      });
    } catch (err) {
      console.error('Failed to fetch messages:', err.message);
      set({ isLoadingMessages: false });
    }
  },

  /**
   * Send a new message (optimistic UI with Socket ack or REST fallback)
   */
  sendMessage: async ({
    text = '',
    type = 'text',
    media = [],
    location = null,
    contact = null,
    replyTo = null
  }) => {
    const activeConv = get().activeConversation;
    if (!activeConv) return;

    const convId = activeConv._id;
    const currentUser = useAuthStore.getState().user;
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Optimistic message placeholder
    const optimisticMsg = {
      _id: clientId,
      clientId,
      conversation: convId,
      chatId: convId,
      sender: {
        _id: currentUser?._id || 'me',
        name: currentUser?.name || 'You',
        username: currentUser?.username || 'you',
        avatar: currentUser?.avatar || ''
      },
      type,
      text: text.trim(),
      media,
      location,
      contact,
      replyTo: replyTo ? { _id: replyTo._id, text: replyTo.text, sender: replyTo.sender } : null,
      reactions: [],
      starredBy: [],
      deliveredTo: [],
      readBy: [],
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    // Append optimistically
    set((state) => {
      const currentList = state.messagesByConv[convId] || [];
      const updated = [...currentList, optimisticMsg];
      return {
        messagesByConv: { ...state.messagesByConv, [convId]: updated },
        messages: updated
      };
    });

    const payload = {
      conversationId: convId,
      clientId,
      type,
      text: text.trim(),
      media,
      location,
      contact,
      replyTo: replyTo?._id
    };

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('message:send', payload, (ack) => {
        if (ack?.success && ack.message) {
          get().replaceOptimisticMessage(convId, clientId, ack.message);
        }
      });
    } else {
      // Fallback: REST API
      try {
        const res = await api.post('/messages', payload);
        get().replaceOptimisticMessage(convId, clientId, res.data.message);
      } catch (err) {
        console.error('REST fallback message send failed:', err.message);
      }
    }
  },

  /**
   * Helper to replace optimistic message with real saved message
   */
  replaceOptimisticMessage: (convId, clientId, realMessage) => {
    set((state) => {
      const list = state.messagesByConv[convId] || [];
      const updated = list.map((m) => (m.clientId === clientId ? realMessage : m));
      return {
        messagesByConv: { ...state.messagesByConv, [convId]: updated },
        messages: String(state.activeConversation?._id) === String(convId) ? updated : state.messages
      };
    });
  },

  /**
   * Edit message
   */
  editMessage: async (messageId, newText) => {
    const socket = getSocket();
    const activeConv = get().activeConversation;
    if (!activeConv) return;

    if (socket && socket.connected) {
      socket.emit('message:edit', {
        conversationId: activeConv._id,
        messageId,
        text: newText
      });
    } else {
      await api.patch(`/messages/${messageId}`, { text: newText });
    }
  },

  /**
   * Delete message
   */
  deleteMessage: async (messageId, scope = 'me') => {
    const socket = getSocket();
    const activeConv = get().activeConversation;
    if (!activeConv) return;

    if (socket && socket.connected && scope === 'everyone') {
      socket.emit('message:delete', {
        conversationId: activeConv._id,
        messageId,
        scope
      });
    } else {
      await api.delete(`/messages/${messageId}?scope=${scope}`);
    }

    // Remove locally if scope === 'me'
    if (scope === 'me') {
      set((state) => {
        const convId = activeConv._id;
        const filtered = (state.messagesByConv[convId] || []).filter((m) => m._id !== messageId);
        return {
          messagesByConv: { ...state.messagesByConv, [convId]: filtered },
          messages: filtered
        };
      });
    }
  },

  /**
   * React to message with emoji
   */
  reactToMessage: async (messageId, emoji) => {
    const socket = getSocket();
    const activeConv = get().activeConversation;
    if (!activeConv) return;

    if (socket && socket.connected) {
      socket.emit('message:react', {
        conversationId: activeConv._id,
        messageId,
        emoji
      });
    } else {
      await api.post(`/messages/${messageId}/react`, { emoji });
    }
  },

  /**
   * Toggle star
   */
  toggleStar: async (messageId) => {
    const res = await api.post(`/messages/${messageId}/star`);
    const { isStarred } = res.data;
    const currentUserId = useAuthStore.getState().user?._id;

    set((state) => {
      const activeConv = state.activeConversation;
      if (!activeConv) return {};
      const convId = activeConv._id;
      const list = state.messagesByConv[convId] || [];

      const updated = list.map((m) => {
        if (m._id !== messageId) return m;
        const stars = Array.isArray(m.starredBy) ? [...m.starredBy] : [];
        if (isStarred) {
          if (!stars.includes(currentUserId)) stars.push(currentUserId);
        } else {
          const idx = stars.indexOf(currentUserId);
          if (idx > -1) stars.splice(idx, 1);
        }
        return { ...m, starredBy: stars };
      });

      return {
        messagesByConv: { ...state.messagesByConv, [convId]: updated },
        messages: updated
      };
    });
  },

  /**
   * Forward message to multiple chats
   */
  forwardMessage: async (messageId, conversationIds) => {
    await api.post('/messages/forward', { messageId, conversationIds });
    get().fetchConversations();
  },

  /**
   * Update chat settings (pin, archive, mute)
   */
  updateChatSettings: async (convId, settings) => {
    try {
      const res = await api.patch(`/chats/${convId}/settings`, settings);
      set((state) => {
        const updated = state.conversations.map((c) =>
          String(c._id) === String(convId)
            ? {
                ...c,
                isPinned: settings.pin !== undefined ? settings.pin : c.isPinned,
                isArchived: settings.archive !== undefined ? settings.archive : c.isArchived,
                isMuted: settings.muteUntil !== undefined ? !!settings.muteUntil : c.isMuted
              }
            : c
        );
        return { conversations: updated, chats: updated };
      });
    } catch (err) {
      console.error('Failed to update chat settings:', err.message);
    }
  },

  /**
   * Typing broadcast helpers
   */
  startTyping: () => {
    const activeConv = get().activeConversation;
    const socket = getSocket();
    if (activeConv && socket && socket.connected) {
      socket.emit('typing:start', { conversationId: activeConv._id });
    }
  },

  stopTyping: () => {
    const activeConv = get().activeConversation;
    const socket = getSocket();
    if (activeConv && socket && socket.connected) {
      socket.emit('typing:stop', { conversationId: activeConv._id });
    }
  },

  /**
   * Initialize all Socket.IO real-time listeners
   */
  initSocketEvents: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('message:new');
    socket.off('message:updated');
    socket.off('message:deleted');
    socket.off('message:status');
    socket.off('typing');
    socket.off('presence:update');
    socket.off('users:online_list');
    socket.off('conversation:updated');

    // New Message
    socket.on('message:new', (msg) => {
      const convId = msg.conversation || msg.chatId;
      const activeConv = get().activeConversation;
      const isCurrentChat = activeConv && String(activeConv._id) === String(convId);

      set((state) => {
        const list = state.messagesByConv[convId] || [];
        // Prevent duplicate if already received via ack
        if (list.some((m) => m._id === msg._id || (m.clientId && m.clientId === msg.clientId))) {
          return {};
        }

        const updated = [...list, msg];

        // Update conversation preview and unread count
        const updatedConvs = state.conversations.map((c) => {
          if (String(c._id) === String(convId)) {
            return {
              ...c,
              lastMessage: msg,
              unreadCount: isCurrentChat ? 0 : (c.unreadCount || 0) + 1
            };
          }
          return c;
        });

        return {
          messagesByConv: { ...state.messagesByConv, [convId]: updated },
          messages: isCurrentChat ? updated : state.messages,
          conversations: updatedConvs,
          chats: updatedConvs
        };
      });

      // If viewing this chat, automatically mark read
      if (isCurrentChat) {
        socket.emit('message:read', { conversationId: convId, upToMessageId: msg._id });
      }
    });

    // Message Updated (Edit or Reaction)
    socket.on('message:updated', (updatedMsg) => {
      const convId = updatedMsg.conversation || updatedMsg.chatId;
      set((state) => {
        const list = state.messagesByConv[convId] || [];
        const updated = list.map((m) => (m._id === updatedMsg._id ? updatedMsg : m));
        return {
          messagesByConv: { ...state.messagesByConv, [convId]: updated },
          messages:
            state.activeConversation && String(state.activeConversation._id) === String(convId)
              ? updated
              : state.messages
        };
      });
    });

    // Message Deleted
    socket.on('message:deleted', ({ conversationId, messageId }) => {
      set((state) => {
        const list = state.messagesByConv[conversationId] || [];
        const updated = list.map((m) =>
          m._id === messageId
            ? { ...m, deletedForEveryone: true, text: 'This message was deleted', media: [] }
            : m
        );
        return {
          messagesByConv: { ...state.messagesByConv, [conversationId]: updated },
          messages:
            state.activeConversation && String(state.activeConversation._id) === String(conversationId)
              ? updated
              : state.messages
        };
      });
    });

    // Message Status Update (delivered / read ticks)
    socket.on('message:status', ({ conversationId, messageId, upToMessageId, status, userId }) => {
      set((state) => {
        const list = state.messagesByConv[conversationId] || [];
        const updated = list.map((m) => {
          if (status === 'read') {
            if (!m.readBy?.some((r) => String(r.user || r) === String(userId))) {
              return { ...m, readBy: [...(m.readBy || []), { user: userId, at: new Date() }] };
            }
          } else if (status === 'delivered') {
            if (messageId && m._id === messageId) {
              if (!m.deliveredTo?.some((d) => String(d.user || d) === String(userId))) {
                return { ...m, deliveredTo: [...(m.deliveredTo || []), { user: userId, at: new Date() }] };
              }
            }
          }
          return m;
        });

        return {
          messagesByConv: { ...state.messagesByConv, [conversationId]: updated },
          messages:
            state.activeConversation && String(state.activeConversation._id) === String(conversationId)
              ? updated
              : state.messages
        };
      });
    });

    // Typing Status
    socket.on('typing', ({ conversationId, userId, userName, isTyping }) => {
      set((state) => {
        const current = state.typingUsers[conversationId] || [];
        let updated;
        if (isTyping) {
          if (!current.some((u) => u.userId === userId)) {
            updated = [...current, { userId, userName }];
          } else {
            updated = current;
          }
        } else {
          updated = current.filter((u) => u.userId !== userId);
        }
        return {
          typingUsers: { ...state.typingUsers, [conversationId]: updated }
        };
      });
    });

    // Presence update
    socket.on('presence:update', ({ userId, isOnline }) => {
      set((state) => {
        const updated = new Set(state.onlineUsers);
        if (isOnline) updated.add(userId);
        else updated.delete(userId);
        return { onlineUsers: updated };
      });
    });

    // Online list on connect
    socket.on('users:online_list', (users) => {
      set({ onlineUsers: new Set(users) });
    });

    // Conversation Updated
    socket.on('conversation:updated', () => {
      get().fetchConversations();
    });
  }
}));

export default useChatStore;
