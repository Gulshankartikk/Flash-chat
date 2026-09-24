import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      // ✅ True while zustand/persist is rehydrating from localStorage on
      // first load. Without this, a fresh page refresh briefly renders as
      // "logged out" before the persisted user loads, causing a flash
      // redirect to the login screen.
      isHydrated: false,

      setUser: (userData) => set({ user: userData, isAuthenticated: true }),

      // ✅ Patch a few fields (name, bio, profilePic, about) without having
      // to pass the whole user object back in — mirrors WhatsApp's
      // "Edit profile" screen, which only ever updates one field at a time.
      updateProfile: (partialData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partialData } : state.user,
        })),

      // ✅ Local-only reflection of this device's own presence, so the
      // "online"/"last seen" shown on *my* profile preview matches what
      // everyone else sees without waiting on a socket round-trip.
      setOnlineStatus: (isOnline) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                isOnline,
                lastSeen: isOnline ? null : new Date().toISOString(),
              }
            : state.user,
        })),

      clearUser: () => {
        set({ user: null, isAuthenticated: false });

        // ✅ Logging out of WhatsApp also tears down the socket connection,
        // active chat, and any per-session UI state — not just the auth
        // flag. Done lazily (require inside the function) to avoid a
        // circular import between the stores at module-load time.
        try {
          const useChatStore = require("./chatStore").default;
          if (useChatStore.getState().resetState) {
            useChatStore.getState().resetState();
          } else {
            useChatStore.getState().disconnectSocket();
            useChatStore.getState().closeConversation();
          }
        } catch (e) {
          // chat store may not exist in every app that reuses this store
        }
        try {
          const useLayoutStore = require("./useLayoutStore").default;
          useLayoutStore.getState().clearSelectedContact();
        } catch (e) {
          // layout store may not exist either — both are optional
        }
      },

      logout: async () => {
        try {
          const { logoutUser } = require("../services/user.service");
          await logoutUser();
        } catch (err) {
          console.error("Backend logout failed:", err);
        }
        get().clearUser();
      },

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export default useUserStore;