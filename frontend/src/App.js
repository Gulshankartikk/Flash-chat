import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './pages/user-login/Login';
import CreateProfile from './pages/user-login/CreateProfile';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ProtectedRoute, PublicRoute, ProfileRoute } from './ProtectedRoute';
import HomePage from './components/HomePage';
import Layout from './components/Layout';
import UserDetail from './components/UserDetail';
import Status from './pages/StatusSection/Status';
import Setting from './pages/SettingSection/Setting';
import JoinGroup from './pages/JoinGroup';
import useUserStore from './store/useUserStore';
import useChatStore from './store/chatStore';
import useThemeStore from './store/useThemeStore';
// import { setUnauthorizedHandler } from './path/to/axiosInstance';
// setUnauthorizedHandler(() => useUserStore.getState().clearUser());

import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';

function App() {
  const connectSocket    = useChatStore((s) => s.connectSocket);
  const disconnectSocket = useChatStore((s) => s.disconnectSocket);
  const user             = useUserStore((s) => s.user);
  const isHydrated       = useUserStore((s) => s.isHydrated);
  const initTheme        = useThemeStore((s) => s.initTheme);

  // Layout needs these — not wired to any trigger yet, so they default
  // closed. Hook up a real toggle (e.g. from a settings/profile menu)
  // when you build that UI.
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const toggleDialog = () => setIsThemeDialogOpen((open) => !open);

  // ✅ Apply the persisted/system theme to <html> once, before anything
  // else renders, so there's no flash of the wrong theme on load.
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (user) {
      connectSocket(user);          // socket connect on login
    }
    return () => disconnectSocket(); // cleanup on logout / unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ✅ zustand/persist reads localStorage asynchronously on first mount.
  // Without waiting for it, ProtectedRoute briefly sees `user === null`
  // on every hard refresh and bounces a logged-in person to /user-login
  // before the real session loads — a flash redirect. Block routing
  // until hydration finishes (this resolves in a single tick, not
  // noticeable as a "loading screen" in practice).
  if (!isHydrated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-[#111b21]">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#00A884] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <CallProvider>
        <ToastContainer position="top-right" autoClose={3000} />
        <Router>
          <Routes>
          {/* Public-only: logged-in user bounced to "/" or "/create-profile" */}
          <Route element={<PublicRoute />}>
            <Route path="/user-login" element={<Login />} />
          </Route>

          {/* Profile Setup: Authenticated users who have not completed profile */}
          <Route element={<ProfileRoute />}>
            <Route path="/create-profile" element={<CreateProfile />} />
          </Route>

          {/* Protected: require valid session and completed profile */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={
                <Layout
                  isThemeDialogOpen={isThemeDialogOpen}
                  toggleDialog={toggleDialog}
                  isStatusPreviewOpen={false}
                  statusPreviewContent={null}
                >
                  <HomePage />
                </Layout>
              }
            />
            <Route
              path="/user-profile"
              element={
                <Layout
                  isThemeDialogOpen={isThemeDialogOpen}
                  toggleDialog={toggleDialog}
                  isStatusPreviewOpen={false}
                  statusPreviewContent={null}
                >
                  <UserDetail />
                </Layout>
              }
            />
            <Route
              path="/status"
              element={
                <Layout
                  isThemeDialogOpen={isThemeDialogOpen}
                  toggleDialog={toggleDialog}
                  isStatusPreviewOpen={false}
                  statusPreviewContent={null}
                >
                  <Status />
                </Layout>
              }
            />
            <Route
              path="/setting"
              element={
                <Layout
                  isThemeDialogOpen={isThemeDialogOpen}
                  toggleDialog={toggleDialog}
                  isStatusPreviewOpen={false}
                  statusPreviewContent={null}
                >
                  <Setting />
                </Layout>
              }
            />
            <Route path="/join/:inviteCode" element={<JoinGroup />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/user-login" replace />} />
        </Routes>
      </Router>
    </CallProvider>
  </SocketProvider>
  );
}

export default App;