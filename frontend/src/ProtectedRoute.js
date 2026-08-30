import React, { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import axios from "axios";
import useUserStore from "./store/useUserStore";

const API_BASE = `${process.env.REACT_APP_API_URL}/api/auth`;

// Calls the backend to verify the auth_token cookie.
// Returns { isAuthenticated: true, user } on success,
// or { isAuthenticated: false } on any failure (expired/missing/invalid cookie).
const checkUserAuth = async () => {
  try {
    const res = await axios.get(`${API_BASE}/check-auth`, {
      withCredentials: true, // required so the auth_token cookie is sent
    });
    const authData = res.data?.data;
    if (authData && authData.isAuthenticated) {
      return { isAuthenticated: true, user: authData.user };
    }
    return { isAuthenticated: false };
  } catch (error) {
    return { isAuthenticated: false };
  }
};

// Shared verification hook — both ProtectedRoute and PublicRoute use
// this, so the session is checked exactly once per route mount and
// both gates agree on the same fresh result instead of one of them
// trusting a possibly-stale store value.
const useAuthCheck = () => {
  const [isChecking, setIsChecking] = useState(true);
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      try {
        const result = await checkUserAuth();
        if (!isMounted) return;

        if (result?.isAuthenticated) {
          setUser(result.user);
        } else {
          clearUser();
        }
      } catch (error) {
        console.error(error);
        if (isMounted) clearUser();
      } finally {
        if (isMounted) setIsChecking(false);
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, [setUser, clearUser]);

  return { isChecking, isAuthenticated };
};

export const ProtectedRoute = () => {
  const location = useLocation();
  const { isChecking, isAuthenticated } = useAuthCheck();
  const user = useUserStore((state) => state.user);

  if (isChecking) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/user-login" state={{ from: location }} replace />;
  }

  // If authenticated but profile is not completed yet, force /create-profile
  if (!user?.profileCompleted && location.pathname !== "/create-profile") {
    return <Navigate to="/create-profile" replace />;
  }

  // user is authenticated — render the protected route
  return <Outlet />;
};

export const ProfileRoute = () => {
  const { isChecking, isAuthenticated } = useAuthCheck();
  const user = useUserStore((state) => state.user);

  if (isChecking) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/user-login" replace />;
  }

  // If already completed profile, go to Home
  if (user?.profileCompleted) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const { isChecking, isAuthenticated } = useAuthCheck();
  const user = useUserStore((state) => state.user);

  if (isChecking) {
    return <Loader />;
  }

  if (isAuthenticated) {
    if (!user?.profileCompleted) {
      return <Navigate to="/create-profile" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// Small inline loader so this file has no missing dependency.
// Swap this out for your own loading component/spinner if you have one.
const Loader = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
    }}
  >
    <span>Checking your session…</span>
  </div>
);