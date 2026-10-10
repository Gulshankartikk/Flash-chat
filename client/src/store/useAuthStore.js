import { create } from 'zustand';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('flash_chat_token') || null,
  isCheckingAuth: true,
  isLoggingIn: false,
  isSendingOtp: false,
  isVerifyingOtp: false,
  isOnboarding: false,
  error: null,
  otpSent: false,
  otpCooldown: 0,

  clearError: () => set({ error: null }),
  setOtpSent: (val) => set({ otpSent: val }),
  setOtpCooldown: (val) => set({ otpCooldown: val }),

  checkAuth: async () => {
    const token = localStorage.getItem('flash_chat_token') || get().token;
    if (!token) {
      set({ user: null, token: null, isCheckingAuth: false });
      return null;
    }
    set({ isCheckingAuth: true });
    try {
      const res = await api.get('/auth/me');
      const user = res.data.user;
      set({ user, token, isCheckingAuth: false });
      connectSocket(token);
      return user;
    } catch {
      set({ user: null, token: null, isCheckingAuth: false });
      localStorage.removeItem('flash_chat_token');
      disconnectSocket();
      return null;
    }
  },

  sendOtp: async (identifier, type) => {
    set({ isSendingOtp: true, error: null });
    try {
      const res = await api.post('/auth/send-otp', { identifier, type });
      set({
        isSendingOtp: false,
        otpSent: true,
        otpCooldown: res.data.cooldownSeconds || 60
      });
      return res.data;
    } catch (err) {
      set({ isSendingOtp: false, error: err.message });
      throw err;
    }
  },

  verifyOtp: async (identifier, otp, deviceInfo) => {
    set({ isVerifyingOtp: true, error: null });
    try {
      const res = await api.post('/auth/verify-otp', { identifier, otp, deviceInfo });
      const { user, accessToken, isOnboarded } = res.data;

      if (accessToken) {
        localStorage.setItem('flash_chat_token', accessToken);
      }

      set({
        user,
        token: accessToken,
        isVerifyingOtp: false,
        otpSent: false
      });

      if (accessToken) {
        connectSocket(accessToken);
      }

      return { user, isOnboarded };
    } catch (err) {
      set({ isVerifyingOtp: false, error: err.message });
      throw err;
    }
  },

  completeOnboarding: async ({ name, username, bio, avatar }) => {
    set({ isOnboarding: true, error: null });
    try {
      const res = await api.post('/auth/onboard', { name, username, bio, avatar });
      const updatedUser = res.data.user;
      set({ user: updatedUser, isOnboarding: false });
      return updatedUser;
    } catch (err) {
      set({ isOnboarding: false, error: err.message });
      throw err;
    }
  },

  checkUsername: async (username) => {
    try {
      const res = await api.get(`/auth/check-username/${encodeURIComponent(username)}`);
      return res.data.available;
    } catch {
      return false;
    }
  },

  getSessions: async () => {
    try {
      const res = await api.get('/auth/sessions');
      return res.data.sessions || [];
    } catch (err) {
      console.warn('Failed to fetch sessions:', err.message);
      return [];
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Logout API error:', err.message);
    } finally {
      localStorage.removeItem('flash_chat_token');
      disconnectSocket();
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('flash_chat_offline_contacts');
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_USER_CACHES' });
          }
        } catch (_) {}
      }
      set({ user: null, token: null, otpSent: false });
    }
  },

  logoutAll: async () => {
    try {
      await api.post('/auth/logout-all');
    } catch (err) {
      console.warn('Logout-all error:', err.message);
    } finally {
      localStorage.removeItem('flash_chat_token');
      disconnectSocket();
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('flash_chat_offline_contacts');
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_USER_CACHES' });
          }
        } catch (_) {}
      }
      set({ user: null, token: null, otpSent: false });
    }
  },

  // Legacy signup
  signup: async ({ name, email, password }) => {
    set({ error: null });
    try {
      const res = await api.post('/auth/signup', { name, email, password });
      const { user, token } = res.data;
      if (token) {
        localStorage.setItem('flash_chat_token', token);
      }
      set({ user, token });
      connectSocket(token);
      return user;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Legacy login
  login: async ({ email, password }) => {
    set({ isLoggingIn: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, token } = res.data;
      if (token) {
        localStorage.setItem('flash_chat_token', token);
      }
      set({ user, token, isLoggingIn: false });
      connectSocket(token);
      return user;
    } catch (err) {
      set({ error: err.message, isLoggingIn: false });
      throw err;
    }
  },

  // Legacy Google Auth
  googleAuth: async (credential) => {
    set({ isLoggingIn: true, error: null });
    try {
      const res = await api.post('/auth/google', { credential });
      const { user, token } = res.data;
      if (token) {
        localStorage.setItem('flash_chat_token', token);
      }
      set({ user, token, isLoggingIn: false });
      connectSocket(token);
      return user;
    } catch (err) {
      set({ error: err.message, isLoggingIn: false });
      throw err;
    }
  },

  updateProfile: async (data) => {
    if (data._id) {
      set({ user: data });
      return data;
    }
    const res = await api.patch('/users/me', data);
    set({ user: res.data.user });
    return res.data.user;
  }
}));

export default useAuthStore;
