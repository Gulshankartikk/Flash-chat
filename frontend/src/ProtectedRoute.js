import React, { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import axios from "axios";
import useUserStore from "./store/useUserStore";

const API_BASE = `${process.env.REACT_APP_API_URL}/api/auth`;

// In-flight singleton promise to avoid duplicate concurrent checks
let authCheckPromise = null;

const checkUserAuth = async () => {
  if (authCheckPromise) return authCheckPromise;

  authCheckPromise = (async () => {
    try {
      const res = await axios.get(`${API_BASE}/check-auth`, {
        withCredentials: true,
        timeout: 10000,
      });
      const authData = res.data?.data;
      if (authData && authData.isAuthenticated) {
        return { isAuthenticated: true, user: authData.user };
      }
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
  const checkedRef = useRef(false);

  useEffect(() => {
    // Only check if user has a cached session
    if (!user || checkedRef.current) return;
    checkedRef.current = true;

    let isMounted = true;
    checkUserAuth().then((result) => {
      if (!isMounted) return;
      if (result?.isAuthenticated) {
        // Sync any updated fields in background
        setUser(result.user);
      } else {
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