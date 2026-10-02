import { create } from 'zustand';

export const useSocialStore = create((set, get) => ({
  // --- STORY VIEWER STATE ---
  isStoryViewerOpen: false,
  storyTrayUsers: [], // Array of { user, isMe, hasUnseen, stories: [] }
  activeUserIndex: 0,
  activeStoryIndex: 0,
  isStoryPaused: false,
  isViewersSheetOpen: false,

  openStoryViewer: (trayUsers, startUserIndex = 0, startStoryIndex = 0) => {
    set({
      storyTrayUsers: trayUsers,
      activeUserIndex: startUserIndex,
      activeStoryIndex: startStoryIndex,
      isStoryViewerOpen: true,
      isStoryPaused: false,
      isViewersSheetOpen: false
    });
  },

  closeStoryViewer: () => {
    set({
      isStoryViewerOpen: false,
      isStoryPaused: false,
      isViewersSheetOpen: false
    });
  },

  setStoryPaused: (paused) => set({ isStoryPaused: paused }),
  setViewersSheetOpen: (open) => set({ isViewersSheetOpen: open }),

  nextStory: () => {
    const { storyTrayUsers, activeUserIndex, activeStoryIndex, closeStoryViewer } = get();
    const currentUser = storyTrayUsers[activeUserIndex];
    if (!currentUser) return closeStoryViewer();

    if (activeStoryIndex < currentUser.stories.length - 1) {
      // Go to next story for this user
      set({ activeStoryIndex: activeStoryIndex + 1, isStoryPaused: false });
    } else {
      // Go to next user in tray
      if (activeUserIndex < storyTrayUsers.length - 1) {
        set({
          activeUserIndex: activeUserIndex + 1,
          activeStoryIndex: 0,
          isStoryPaused: false,
          isViewersSheetOpen: false
        });
      } else {
        // End of tray
        closeStoryViewer();
      }
    }
  },

  prevStory: () => {
    const { storyTrayUsers, activeUserIndex, activeStoryIndex } = get();
    if (activeStoryIndex > 0) {
      set({ activeStoryIndex: activeStoryIndex - 1, isStoryPaused: false });
    } else if (activeUserIndex > 0) {
      const prevUser = storyTrayUsers[activeUserIndex - 1];
      set({
        activeUserIndex: activeUserIndex - 1,
        activeStoryIndex: (prevUser?.stories?.length || 1) - 1,
        isStoryPaused: false,
        isViewersSheetOpen: false
      });
    }
  },

  // --- REELS STATE ---
  isMuted: localStorage.getItem('flash_reels_muted') === 'true',
  toggleMute: () => {
    const next = !get().isMuted;
    localStorage.setItem('flash_reels_muted', String(next));
    set({ isMuted: next });
  },

  // --- CREATE MODAL STATE ---
  isCreateModalOpen: false,
  createType: 'post', // 'post' | 'reel' | 'story'
  openCreateModal: (type = 'post') => set({ isCreateModalOpen: true, createType: type }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  // --- COMMENTS BOTTOM SHEET (Shared for posts & reels) ---
  commentsSheet: {
    isOpen: false,
    targetType: 'post', // 'post' | 'reel'
    targetId: null,
    targetOwnerId: null
  },
  openCommentsSheet: (targetType, targetId, targetOwnerId) =>
    set({ commentsSheet: { isOpen: true, targetType, targetId, targetOwnerId } }),
  closeCommentsSheet: () =>
    set({ commentsSheet: { isOpen: false, targetType: 'post', targetId: null, targetOwnerId: null } }),

  // --- SHARE BOTTOM SHEET ---
  shareSheet: {
    isOpen: false,
    contentType: 'post', // 'post' | 'reel' | 'story' | 'profile'
    contentId: null,
    snapshot: null
  },
  openShareSheet: (contentType, contentId, snapshot) =>
    set({ shareSheet: { isOpen: true, contentType, contentId, snapshot } }),
  closeShareSheet: () =>
    set({ shareSheet: { isOpen: false, contentType: 'post', contentId: null, snapshot: null } }),

  // --- NOTIFICATIONS BADGE ---
  unreadNotificationsCount: 0,
  setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
  incrementUnreadNotifications: () =>
    set((state) => ({ unreadNotificationsCount: state.unreadNotificationsCount + 1 })),
  clearUnreadNotifications: () => set({ unreadNotificationsCount: 0 })
}));
