import { create } from 'zustand';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('flash_chat_token') || null,
  isCheckingAuth: true,
  isLoggingIn: false,
  isSigningUp: false,
  error: null,

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.user, isCheckingAuth: false });
      connectSocket(get().token);
    } catch {
      set({ user: null, token: null, isCheckingAuth: false });
      localStorage.removeItem('flash_chat_token');
      disconnectSocket();
    }
  },

  signup: async ({ name, email, password }) => {
    set({ isSigningUp: true, error: null });
    try {
      const res = await api.post('/auth/signup', { name, email, password });
      const { user, token } = res.data;
      if (token) {
        localStorage.setItem('flash_chat_token', token);
      }
      set({ user, token, isSigningUp: false });
      connectSocket(token);
      return user;
    } catch (err) {
      set({ error: err.message, isSigningUp: false });
      throw err;
    }
  },

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

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Logout API error:', err.message);
    } finally {
      localStorage.removeItem('flash_chat_token');
      disconnectSocket();
      set({ user: null, token: null });
    }
  },

  updateProfile: async (data) => {
    const res = await api.patch('/users/profile', data);
    set({ user: res.data.user });
    return res.data.user;
  }
}));
