import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Flame,
  Bookmark,
  Sparkles,
  User,
  Search,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useSocialStore } from '../features/social/store/useSocialStore';
import { Avatar } from './Avatar';

export const Sidebar = ({ onOpenSearch }) => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { unreadNotificationsCount } = useSocialStore();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Chats', path: '/chats', icon: MessageSquare, badge: null },
    {
      label: 'Social',
      path: '/social',
      icon: Flame,
      badge: unreadNotificationsCount > 0 ? (unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount) : 'Feed',
      isAlert: unreadNotificationsCount > 0
    },
    { label: 'Pocket', path: '/pocket', icon: Bookmark, badge: 'Vault' },
    { label: 'Gemini AI', path: '/ai', icon: Sparkles, badge: 'AI' },
    { label: 'My Profile', path: '/profile', icon: User, badge: null }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="hidden md:flex flex-col justify-between w-64 h-screen bg-white border-r border-[#FED7AA] p-4 flex-shrink-0 select-none shadow-sm z-30">
      {/* Brand & Search Top Section */}
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white flex items-center justify-center font-black text-xl shadow-lg shadow-orange-500/25 flex-shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-[#1F2937]">
                Flash Chat
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-[#F97316]">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280]">Messaging & Social Super-App</p>
          </div>
        </div>

        {/* Global Search Button */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/50 hover:bg-[#FFF7ED] text-[#6B7280] hover:text-[#1F2937] text-xs font-medium transition mb-5 cursor-pointer shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#F97316]" />
            <span>Search users, tags...</span>
          </div>
          <kbd className="text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded border border-[#FED7AA] text-[#6B7280]">
            ⌘K
          </kbd>
        </button>

        {/* Navigation Tabs */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-[#F97316]/10 to-[#EC4899]/10 text-[#F97316] border border-[#FED7AA]'
                      : 'text-[#6B7280] hover:text-[#1F2937] hover:bg-[#FFF7ED]/60'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 ${
                          isActive ? 'text-[#F97316] stroke-[2.5px]' : 'text-[#6B7280]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.isAlert
                            ? 'bg-[#F43F5E] text-white shadow-xs'
                            : 'bg-orange-100 text-[#F97316]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Card & Controls Bottom Section */}
      <div className="pt-4 border-t border-[#FED7AA]/60 space-y-3">
        {/* Theme and quick settings */}
        <div className="flex items-center justify-between px-2 text-xs text-[#6B7280]">
          <span>Appearance</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-[#FED7AA] hover:bg-[#FFF7ED] text-[#1F2937] transition cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* User Mini Profile */}
        <div
          onClick={() => navigate('/profile')}
          className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#FFF7ED] transition cursor-pointer border border-transparent hover:border-[#FED7AA]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              src={user?.avatar}
              alt={user?.name || 'User'}
              size="sm"
              isOnline={user?.isOnline}
              showStatus
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1F2937] truncate">
                {user?.name || 'Flash User'}
              </p>
              <p className="text-[11px] text-[#6B7280] truncate">
                @{user?.username || 'user'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            className="p-2 rounded-xl text-[#6B7280] hover:text-[#F43F5E] hover:bg-rose-50 transition"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
