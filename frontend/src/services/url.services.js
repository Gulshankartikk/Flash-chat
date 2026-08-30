import axios from "axios";

// .env mein: REACT_APP_API_URL=http://localhost:8000  (no /api, no /auth)
const apiUrl = `${process.env.REACT_APP_API_URL}/api`;

const axiosInstance = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000, // ✅ don't hang forever on a dead connection
});

// ✅ Session-expiry handling, centralised here instead of every caller
// having to check `err.response.status === 401` themselves. When the
// backend says the session/cookie is no longer valid, clear local auth
// state and bounce to login — exactly what WhatsApp Web does when it
// detects you've been logged out elsewhere.
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

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

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      error.message = "Network error — check your connection and try again.";
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/refresh-token") ||
      originalRequest.url?.includes("/auth/verify-otp") ||
      originalRequest.url?.includes("/auth/send-otp");

    if (error.response.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosInstance(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axiosInstance.post("/auth/refresh-token");
        processQueue(null);
        return axiosInstance(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (onUnauthorized) {
          onUnauthorized();
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response.status === 401 && isAuthEndpoint && onUnauthorized) {
      onUnauthorized();
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;