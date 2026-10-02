import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Plus, Send, Flame, Film, Compass, Bell } from 'lucide-react';
import { useSocialStore } from '../store/useSocialStore';
import { fetchUnreadNotificationsCount } from '../api/api';

export const SocialHeader = ({ activeTab = 'feed' }) => {
  const navigate = useNavigate();
  const { openCreateModal, unreadNotificationsCount, setUnreadNotificationsCount } = useSocialStore();

  useEffect(() => {
    fetchUnreadNotificationsCount()
      .then((res) => {
        if (res.success && res.unreadCount !== undefined) {
          setUnreadNotificationsCount(res.unreadCount);
        }
      })
      .catch(() => {});
  }, [setUnreadNotificationsCount]);

  const tabs = [
    { id: 'feed', label: 'Feed', icon: Flame, path: '/social' },
    { id: 'reels', label: 'Reels', icon: Film, path: '/social/reels' },
    { id: 'explore', label: 'Explore', icon: Compass, path: '/social/explore' },
    {
      id: 'notifications',
      label: 'Activity',
      icon: Bell,
      path: '/social/notifications',
      badge: unreadNotificationsCount
    }
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#FFF7ED]/90 backdrop-blur-md border-b border-[#FED7AA]/60 px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Sub-tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={`relative px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-100/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#F43F5E] text-white text-[10px] flex items-center justify-center font-bold">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right action buttons: Create (+) and Direct Messages (DM) */}
        <div className="flex items-center gap-2">
          {/* Create Button */}
          <button
            type="button"
            onClick={() => openCreateModal('post')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#FED7AA] text-[#1F2937] font-bold text-xs shadow-xs hover:border-[#F97316] hover:text-[#F97316] transition cursor-pointer"
            title="Create Post, Reel, or Story"
          >
            <Plus className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* DM Button -> Links to /chats (unified chat engine) */}
          <button
            type="button"
            onClick={() => navigate('/chats')}
            className="w-8 h-8 rounded-full bg-white border border-[#FED7AA] text-[#1F2937] flex items-center justify-center shadow-xs hover:border-[#F97316] hover:text-[#F97316] transition cursor-pointer"
            title="Direct Messages"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
