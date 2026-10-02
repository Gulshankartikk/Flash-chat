import { create } from 'zustand';
import { setPocketTokenGetter } from '../../../services/api';

export const usePocketStore = create((set, get) => {
  // Wire in-memory token getter into Axios interceptor
  setPocketTokenGetter(() => get().pocketToken);

  return {
    // In-memory unlock state ONLY (NEVER saved to localStorage)
    pocketToken: null,
    isUnlocked: false,
    unlockExpiresAt: null,

    // Lockout state
    failedAttempts: 0,
    isTemporarilyLocked: false,
    lockedUntil: null,
    autoLockMinutes: 5,

    // UI state
    viewMode: localStorage.getItem('pocket_view_mode') || 'masonry',
    selectedIds: [],
    isMultiSelectMode: false,
    activeFilter: 'all',
    activeFolderId: null,
    searchQuery: '',

    // Actions
    setPocketToken: (token, expiresIn = 600) => {
      const expiresAt = Date.now() + expiresIn * 1000;
      set({
        pocketToken: token,
        isUnlocked: true,
        unlockExpiresAt: expiresAt,
        failedAttempts: 0,
        isTemporarilyLocked: false,
        lockedUntil: null
      });
    },

    lockVault: () => {
      set({
        pocketToken: null,
        isUnlocked: false,
        unlockExpiresAt: null,
        selectedIds: [],
        isMultiSelectMode: false
      });
    },

    setLockout: (seconds = 900) => {
      const until = Date.now() + seconds * 1000;
      set({
        isTemporarilyLocked: true,
        lockedUntil: until,
        pocketToken: null,
        isUnlocked: false
      });
    },

    clearLockout: () => {
      set({
        isTemporarilyLocked: false,
        lockedUntil: null,
        failedAttempts: 0
      });
    },

    setFailedAttempts: (count) => {
      set({ failedAttempts: count });
    },

    setAutoLockMinutes: (mins) => {
      set({ autoLockMinutes: mins });
    },

    setViewMode: (mode) => {
      localStorage.setItem('pocket_view_mode', mode);
      set({ viewMode: mode });
    },

    setActiveFilter: (filter) => {
      set({ activeFilter: filter });
    },

    setActiveFolderId: (folderId) => {
      set({ activeFolderId: folderId });
    },

    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    // Multi-select actions
    toggleSelectMode: (forceState) => {
      set((state) => {
        const nextState = typeof forceState === 'boolean' ? forceState : !state.isMultiSelectMode;
        return {
          isMultiSelectMode: nextState,
          selectedIds: nextState ? state.selectedIds : []
        };
      });
    },

    toggleSelectItem: (id) => {
      set((state) => {
        const isSelected = state.selectedIds.includes(id);
        const nextSelected = isSelected
          ? state.selectedIds.filter((item) => item !== id)
          : [...state.selectedIds, id];

        return {
          selectedIds: nextSelected,
          isMultiSelectMode: nextSelected.length > 0 ? true : state.isMultiSelectMode
        };
      });
    },

    selectAllItems: (allIds) => {
      set({
        selectedIds: allIds,
        isMultiSelectMode: true
      });
    },

    clearSelection: () => {
      set({
        selectedIds: [],
        isMultiSelectMode: false
      });
    }
  };
});

// Auto-lock when tab goes to background
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const { isUnlocked, lockVault } = usePocketStore.getState();
      if (isUnlocked) {
        lockVault();
      }
    }
  });
}
