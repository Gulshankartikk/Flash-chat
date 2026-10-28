import axios from 'axios';
import { updateSocketToken } from './socket';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

let pocketTokenGetter = null;

export const setPocketTokenGetter = (fn) => {
  pocketTokenGetter = fn;
};

// Request interceptor: attach Bearer token and scoped X-Pocket-Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('flash_chat_token');
    if (token && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (pocketTokenGetter && config.url && config.url.includes('/pocket')) {
      const pocketToken = pocketTokenGetter();
      if (pocketToken) {
        config.headers['X-Pocket-Token'] = pocketToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto silent refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const requestUrl = originalRequest?.url || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/signup') ||
      requestUrl.includes('/auth/verify-otp') ||
      requestUrl.includes('/auth/send-otp') ||
      requestUrl.includes('/auth/refresh-token') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    if (
      error.response?.status === 401 &&
      !isAuthRoute &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshUrl = import.meta.env.VITE_API_URL
          ? `${import.meta.env.VITE_API_URL}/api/auth/refresh-token`
          : '/api/auth/refresh-token';
        const res = await axios.post(
          refreshUrl,
          {},
          { withCredentials: true }
        );
        const { accessToken } = res.data;
        if (accessToken) {
          localStorage.setItem('flash_chat_token', accessToken);
          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          updateSocketToken(accessToken);
          processQueue(null, accessToken);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('flash_chat_token');
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('flash_chat_auth_logout'));
          } catch (_) {}
          const publicRoutes = ['/login', '/signup', '/welcome', '/forgot-password', '/reset-password'];
          const isPublic = publicRoutes.some((p) => window.location.pathname.startsWith(p));
          if (!isPublic && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
