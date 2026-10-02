import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { BottomNav } from '../components/BottomNav';
import { PageHeader } from '../components/PageHeader';
import { UserSearchModal } from '../features/search/UserSearchModal';
import { ToastProvider } from '../components/Toast';

export const AppLayout = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  // Determine current page title from pathname
  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path.startsWith('/chats')) {
      return { title: 'Chats', subtitle: 'Encrypted real-time messaging & calls' };
    }
    if (path.startsWith('/social')) {
      return { title: 'Social Feed', subtitle: 'Posts, stories, and viral reels' };
    }
    if (path.startsWith('/pocket')) {
      return { title: 'Pocket Vault', subtitle: 'Your secure personal data store' };
    }
    if (path.startsWith('/ai')) {
      return { title: 'Gemini AI Assistant', subtitle: 'Multimodal intelligence & smart actions' };
    }
    if (path.startsWith('/profile')) {
      return { title: 'Profile & Settings', subtitle: 'Manage identity, privacy & security' };
    }
    if (path.startsWith('/u/')) {
      return { title: 'User Profile', subtitle: 'Public profile overview' };
    }
    return { title: 'Flash Chat', subtitle: 'Unified Messaging & Social Super-App' };
  };

  const { title, subtitle } = getHeaderInfo();

  // Global keyboard shortcut: Cmd+K / Ctrl+K opens search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#FFF7ED] text-[#1F2937]">
        {/* Desktop Left Sidebar */}
        <Sidebar onOpenSearch={() => setIsSearchOpen(true)} />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-screen overflow-hidden">
          {/* Header */}
          <PageHeader
            title={title}
            subtitle={subtitle}
            onOpenSearch={() => setIsSearchOpen(true)}
          />

          {/* Tab Route Content */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <Outlet />
          </main>

          {/* Mobile Bottom Navigation */}
          <BottomNav />
        </div>

        {/* Global User Search Modal */}
        <UserSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>
    </ToastProvider>
  );
};

export default AppLayout;
