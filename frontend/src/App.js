import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ProtectedRoute, PublicRoute, ProfileRoute } from './ProtectedRoute';
import useUserStore from './store/useUserStore';
import useChatStore from './store/chatStore';
import useThemeStore from './store/useThemeStore';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { setUnauthorizedHandler } from './services/url.services';

// Wire up global unauthorized handler to clear stale session
setUnauthorizedHandler(() => useUserStore.getState().clearUser());

// Lazy-loaded route components for code-splitting
const Login = lazy(() => import('./pages/user-login/Login'));
const CreateProfile = lazy(() => import('./pages/user-login/CreateProfile'));
const HomePage = lazy(() => import('./components/HomePage'));
const Layout = lazy(() => import('./components/Layout'));
const UserDetail = lazy(() => import('./components/UserDetail'));
const Status = lazy(() => import('./pages/StatusSection/Status'));
const Setting = lazy(() => import('./pages/SettingSection/Setting'));
const JoinGroup = lazy(() => import('./pages/JoinGroup'));

// Lightweight, seamless page fallback
const PageFallback = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-[#000000]">
    <div className="w-7 h-7 border-2 border-slate-200 dark:border-[#222222] border-t-[#FF6B00] rounded-full animate-spin" />
  </div>
);

function App() {
  const connectSocket    = useChatStore((s) => s.connectSocket);
  const disconnectSocket = useChatStore((s) => s.disconnectSocket);
  const user             = useUserStore((s) => s.user);
  const isHydrated       = useUserStore((s) => s.isHydrated);
  const initTheme        = useThemeStore((s) => s.initTheme);

  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const toggleDialog = () => setIsThemeDialogOpen((open) => !open);

  // Apply theme to <html> before render to avoid flash of wrong theme
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // Connect socket when user is available; disconnect on logout/unmount
  useEffect(() => {
    if (user?._id) {
      connectSocket(user);
    }
    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  if (!isHydrated) {
    return <PageFallback />;
  }

  return (
    <SocketProvider>
      <CallProvider>
        <ToastContainer position="top-right" autoClose={3000} />
        <Router>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public-only: logged-in user redirected to "/" or "/create-profile" */}
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
          </Suspense>
        </Router>
      </CallProvider>
    </SocketProvider>
  );
}

export default App;