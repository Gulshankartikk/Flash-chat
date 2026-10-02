import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';
import { AppLayout } from './layouts/AppLayout';
import { CallProvider, IncomingCallModal, CallScreen } from './features/calls';

// Code-splitting with lazy-loaded route components
const WelcomePage = lazy(() =>
  import('./pages/WelcomePage').then((module) => ({ default: module.WelcomePage }))
);
const ChatPage = lazy(() =>
  import('./pages/ChatPage').then((module) => ({ default: module.ChatPage }))
);
const SocialPage = lazy(() =>
  import('./pages/SocialPage').then((module) => ({ default: module.SocialPage }))
);
const PocketPage = lazy(() =>
  import('./pages/PocketPage').then((module) => ({ default: module.PocketPage }))
);
const PocketDetailPage = lazy(() =>
  import('./features/pocket').then((module) => ({ default: module.PocketDetailPage }))
);
const AiPage = lazy(() =>
  import('./pages/AiPage').then((module) => ({ default: module.AiPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage }))
);
const PublicProfilePage = lazy(() =>
  import('./pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage }))
);
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
);
const SignupPage = lazy(() =>
  import('./pages/SignupPage').then((module) => ({ default: module.SignupPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage
  }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage
  }))
);

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FFF7ED]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-[#6B7280]">Loading Flash Chat...</span>
    </div>
  </div>
);

export function App() {
  const { checkAuth } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
    checkAuth();
  }, [checkAuth, initTheme]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CallProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Protected Routes (require authenticated user session) */}
            <Route element={<ProtectedRoute />}>
              {/* Standalone Onboarding screen if user not onboarded yet */}
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* App Shell with 5 Tabs */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/chats" replace />} />
                <Route path="/chats" element={<ChatPage />} />
                <Route path="/chats/:conversationId" element={<ChatPage />} />
                <Route path="/social" element={<SocialPage />} />
                <Route path="/social/reels" element={<SocialPage />} />
                <Route path="/social/explore" element={<SocialPage />} />
                <Route path="/social/search" element={<SocialPage />} />
                <Route path="/social/notifications" element={<SocialPage />} />
                <Route path="/social/post/:id" element={<SocialPage />} />
                <Route path="/social/hashtag/:tag" element={<SocialPage />} />
                <Route path="/pocket" element={<PocketPage />} />
                <Route path="/pocket/folder/:id" element={<PocketPage />} />
                <Route path="/pocket/item/:id" element={<PocketDetailPage />} />
                <Route path="/ai" element={<AiPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<Navigate to="/profile" replace />} />
                <Route path="/u/:username" element={<PublicProfilePage />} />
              </Route>
            </Route>

            {/* Public Auth Routes (authenticated users redirected to Home "/") */}
            <Route element={<PublicRoute />}>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<Navigate to="/chats" replace />} />
          </Routes>
        </Suspense>

        {/* Global WebRTC Calling UI */}
        <IncomingCallModal />
        <CallScreen />
      </CallProvider>
    </BrowserRouter>
  );
}

export default App;
