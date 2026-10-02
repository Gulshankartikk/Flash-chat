import { create } from 'zustand';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuthStore } from './useAuthStore';

export const useChatStore = create((set, get) => ({
  chats: [],
  activeChat: null,
  messages: [],
  hasMore: false,
  nextCursor: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  onlineUsers: new Set(),
  typingUsers: {}, // chatId -> [userName, ...]
  searchResults: [],
  isSearching: false,

  setOnlineUsers: (users) => set({ onlineUsers: new Set(users) }),

  fetchChats: async () => {
    set({ isLoadingChats: true });
    try {
      const res = await api.get('/chats');
      set({ chats: res.data.chats, isLoadingChats: false });
    } catch (err) {
      console.error('Failed to fetch chats:', err);
      set({ isLoadingChats: false });
    }
  },

  setActiveChat: async (chat) => {
    const previousChat = get().activeChat;
    const socket = getSocket();

    if (previousChat && socket) {
      socket.emit('chat:leave', previousChat._id);
    }

    set({
      activeChat: chat,
      messages: [],
      hasMore: false,
      nextCursor: null
    });

    if (!chat) return;

    if (socket) {
      socket.emit('chat:join', chat._id);
    }

    // Reset unread count locally and on backend
    get().markAsRead(chat._id);
    get().fetchMessages(chat._id);
  },

  fetchMessages: async (chatId, before = null) => {
    set({ isLoadingMessages: true });
    try {
      const url = before
        ? `/messages/${chatId}?before=${encodeURIComponent(before)}&limit=30`
        : `/messages/${chatId}?limit=30`;

      const res = await api.get(url);
      const { messages, hasMore, nextCursor } = res.data;

      set((state) => ({
        messages: before ? [...messages, ...state.messages] : messages,
        hasMore,
        nextCursor,
        isLoadingMessages: false
      }));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async ({ content, file, replyTo }) => {
    const activeChat = get().activeChat;
    if (!activeChat) return;

    const currentUser = useAuthStore.getState().user;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      chatId: activeChat._id,
      content,
      mediaUrl: file ? URL.createObjectURL(file) : '',
      mediaType: file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text',
      fileName: file ? file.name : '',
      fileSize: file ? file.size : 0,
      sender: currentUser
        ? { _id: currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
        : { _id: 'me', name: 'You' },
      createdAt: new Date().toISOString(),
      readBy: [],
      deliveredTo: [],
      isOptimistic: true
    };

    // Optimistic UI update
    set((state) => ({
      messages: [...state.messages, optimisticMessage]
    }));

    try {
      const formData = new FormData();
      formData.append('chatId', activeChat._id);
      if (content) formData.append('content', content);
      if (replyTo) formData.append('replyTo', replyTo);
      if (file) formData.append('attachment', file);

      const res = await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const savedMessage = res.data.message;

      // Replace optimistic message with actual persisted message
      set((state) => ({
        messages: state.messages.map((m) => (m._id === tempId ? savedMessage : m))
      }));
    } catch (err) {
      // Remove failed optimistic message
      set((state) => ({
        messages: state.messages.filter((m) => m._id !== tempId)
      }));
      throw err;
    }
  },

  editMessage: async (messageId, content) => {
    try {
      const res = await api.put(`/messages/${messageId}`, { content });
      const updated = res.data.message;
      set((state) => ({
        messages: state.messages.map((m) => (m._id === messageId ? updated : m))
      }));
    } catch (err) {
      console.error('Failed to edit message:', err);
      throw err;
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}`);
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, content: 'This message was deleted', mediaUrl: '' }
            : m
        )
      }));
    } catch (err) {
      console.error('Failed to delete message:', err);
      throw err;
    }
  },

  markAsRead: async (chatId) => {
    try {
      await api.patch(`/messages/read/${chatId}`);
      const currentUser = useAuthStore.getState().user;
      const currentUserId = currentUser?._id;

      // Clear unread count for current user in local chat list
      set((state) => ({
        chats: state.chats.map((c) => {
          if (c._id === chatId) {
            const updatedCounts = { ...(c.unreadCounts || {}) };
            if (currentUserId) {
              updatedCounts[currentUserId] = 0;
            }
            return {
              ...c,
              unreadCounts: updatedCounts
            };
          }
          return c;
        })
      }));
    } catch (err) {
      console.warn('Failed to mark chat as read:', err.message);
    }
  },

  createPrivateChat: async (recipientId) => {
    const res = await api.post('/chats/private', { recipientId });
    const chat = res.data.chat;
    set((state) => {
      const exists = state.chats.some((c) => c._id === chat._id);
      return {
        chats: exists ? state.chats : [chat, ...state.chats],
        activeChat: chat
      };
    });
    get().setActiveChat(chat);
    return chat;
  },

  createGroupChat: async ({ name, participantIds }) => {
    const res = await api.post('/chats/group', { name, participantIds });
    const group = res.data.chat;
    set((state) => ({
      chats: [group, ...state.chats],
      activeChat: group
    }));
    get().setActiveChat(group);
    return group;
  },

  searchUsers: async (query) => {
    if (!query || !query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      set({ searchResults: res.data.users, isSearching: false });
    } catch (err) {
      console.error('Failed to search users:', err);
      set({ isSearching: false, searchResults: [] });
    }
  },

  // Socket event wireup
  initSocketEvents: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('message:new');
    socket.off('message:edited');
    socket.off('message:deleted');
    socket.off('message:read_receipt');
    socket.off('typing:status');
    socket.off('user:presence');
    socket.off('users:online_list');
    socket.off('chat:new_group');
    socket.off('chat:updated');

    socket.on('message:new', (message) => {
      const { activeChat } = get();
      if (activeChat && activeChat._id === message.chatId) {
        set((state) => {
          // Avoid duplicate insertion
          const exists = state.messages.some((m) => m._id === message._id);
          if (exists) return state;
          return { messages: [...state.messages, message] };
        });
        // Mark as read immediately if chat is currently open
        get().markAsRead(activeChat._id);
      } else {
        // Increment unread count in chat list
        get().fetchChats();
      }
    });

    socket.on('message:edited', (updatedMessage) => {
      set((state) => ({
        messages: state.messages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m))
      }));
    });

    socket.on('message:deleted', ({ messageId }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, content: 'This message was deleted', mediaUrl: '' }
            : m
        )
      }));
    });

    socket.on('message:read_receipt', ({ chatId, readByUserId }) => {
      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.chatId === chatId && !m.readBy?.includes(readByUserId)) {
            return { ...m, readBy: [...(m.readBy || []), readByUserId] };
          }
          return m;
        })
      }));
    });

    socket.on('typing:status', ({ chatId, userName, isTyping }) => {
      set((state) => {
        const current = state.typingUsers[chatId] || [];
        let updated;
        if (isTyping) {
          updated = current.includes(userName) ? current : [...current, userName];
        } else {
          updated = current.filter((u) => u !== userName);
        }
        return {
          typingUsers: { ...state.typingUsers, [chatId]: updated }
        };
      });
    });

    socket.on('user:presence', ({ userId, isOnline }) => {
      set((state) => {
        const next = new Set(state.onlineUsers);
        if (isOnline) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return { onlineUsers: next };
      });
    });

    socket.on('users:online_list', (users) => {
      set({ onlineUsers: new Set(users) });
    });

    socket.on('chat:new_group', (group) => {
      set((state) => ({
        chats: [group, ...state.chats]
      }));
    });

    socket.on('chat:updated', () => {
      get().fetchChats();
    });
  }
}));
