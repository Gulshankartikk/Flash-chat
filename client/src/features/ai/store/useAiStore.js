import { create } from 'zustand';

export const useAiStore = create((set, get) => ({
  activeChatId: null,
  drafts: {},
  isStreaming: false,
  streamingText: '',
  isConsentAccepted: false,
  usage: {
    used: 0,
    limit: 50,
    remaining: 50,
    resetAt: null
  },

  setActiveChatId: (activeChatId) => set({ activeChatId }),

  setDraft: (chatId, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [chatId || 'new']: text }
    })),

  clearDraft: (chatId) =>
    set((state) => {
      const newDrafts = { ...state.drafts };
      delete newDrafts[chatId || 'new'];
      return { drafts: newDrafts };
    }),

  setIsStreaming: (isStreaming) => set({ isStreaming }),

  setStreamingText: (streamingText) => set({ streamingText }),

  appendStreamingText: (token) =>
    set((state) => ({
      streamingText: state.streamingText + token
    })),

  setConsentAccepted: (isConsentAccepted) => set({ isConsentAccepted }),

  setUsage: (usage) => set({ usage }),

  resetStore: () =>
    set({
      activeChatId: null,
      drafts: {},
      isStreaming: false,
      streamingText: '',
      usage: { used: 0, limit: 50, remaining: 50, resetAt: null }
    })
}));
