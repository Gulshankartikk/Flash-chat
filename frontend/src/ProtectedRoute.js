import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import axios from "axios";
import useUserStore from "./store/useUserStore";

const API_BASE = `${process.env.REACT_APP_API_URL}/api/auth`;

// In-flight singleton promise and cooldown timestamp to avoid duplicate checks
let authCheckPromise = null;
let lastAuthCheckTime = 0;
const AUTH_CHECK_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const checkUserAuth = async () => {
  if (authCheckPromise) return authCheckPromise;
  if (Date.now() - lastAuthCheckTime < AUTH_CHECK_COOLDOWN_MS) {
    return { isAuthenticated: true, cached: true };
  }

  authCheckPromise = (async () => {
    try {
      const res = await axios.get(`${API_BASE}/check-auth`, {
        withCredentials: true,
        timeout: 10000,
      });
      const authData = res.data?.data;
      if (authData && authData.isAuthenticated) {
        lastAuthCheckTime = Date.now();
        return { isAuthenticated: true, user: authData.user };
      }
      lastAuthCheckTime = 0;
      return { isAuthenticated: false };
    } catch (error) {
      return { isAuthenticated: false };
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
};

// Non-blocking background session verification hook
const useBackgroundAuthSync = () => {
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    // Only check if user has a cached session and cooldown elapsed
    if (!user || Date.now() - lastAuthCheckTime < AUTH_CHECK_COOLDOWN_MS) return;

    let isMounted = true;
    checkUserAuth().then((result) => {
      if (!isMounted) return;
      if (result?.cached) return;
      if (result?.isAuthenticated) {
        // Sync any updated fields in background
        if (result.user) setUser(result.user);
      } else {
        lastAuthCheckTime = 0;
        clearUser();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, setUser, clearUser]);
};

export const ProtectedRoute = () => {
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated || !!user);

  useBackgroundAuthSync();

  if (!isAuthenticated) {
    return <Navigate to="/user-login" state={{ from: location }} replace />;
  }

  // If authenticated but profile is not completed yet, force /create-profile
  if (!user?.profileCompleted && location.pathname !== "/create-profile") {
    return <Navigate to="/create-profile" replace />;
  }

  return <Outlet />;
};

export const ProfileRoute = () => {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated || !!user);

  useBackgroundAuthSync();

  if (!isAuthenticated) {
    return <Navigate to="/user-login" replace />;
  }

  if (user?.profileCompleted) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated || !!user);

  useBackgroundAuthSync();

  if (isAuthenticated) {
    if (!user?.profileCompleted) {
      return <Navigate to="/create-profile" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};