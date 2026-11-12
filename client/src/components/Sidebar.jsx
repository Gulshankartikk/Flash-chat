import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Flame,
  Bookmark,
  Sparkles,
  User,
  Users,
  Search,
  LogOut,
  Moon,
  Sun,
  LifeBuoy
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useChatStore } from '../store/useChatStore';
import { useSocialStore } from '../features/social/store/useSocialStore';
import { Avatar } from './Avatar';

export const Sidebar = ({ onOpenSearch }) => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { conversations } = useChatStore();
  const { unreadNotificationsCount } = useSocialStore();
  const [hasPocketNotification, setHasPocketNotification] = React.useState(false);
  const navigate = useNavigate();

  const unreadChatCount =
    conversations?.reduce((acc, c) => acc + (c.unreadCount || 0), 0) || 0;

  React.useEffect(() => {
    const handlePocketSaved = () => setHasPocketNotification(true);
    window.addEventListener('pocket_item_saved', handlePocketSaved);
    return () => window.removeEventListener('pocket_item_saved', handlePocketSaved);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navGroups = [
    {
      group: 'MAIN',
      items: [
        {
          label: 'Chats',
          path: '/chats',
          icon: MessageSquare,
          badge: unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : null,
          isAlert: unreadChatCount > 0
        },
        {
          label: 'Social',
          path: '/social',
          icon: Flame,
          badge:
            unreadNotificationsCount > 0
              ? unreadNotificationsCount > 9
                ? '9+'
                : unreadNotificationsCount
              : null,
          isAlert: unreadNotificationsCount > 0
        }
      ]
    },
    {
      group: 'WORKSPACE',
      items: [
        { label: 'Contacts', path: '/contacts', icon: Users, badge: null },
        {
          label: 'Pocket Vault',
          path: '/pocket',
          icon: Bookmark,
          badge: hasPocketNotification ? 'Saved' : null,
          isAlert: hasPocketNotification
        },
        { label: 'Flash AI', path: '/ai', icon: Sparkles, badge: 'AI' }
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { label: 'Help & Support', path: '/support', icon: LifeBuoy, badge: null },
        { label: 'My Profile', path: '/profile', icon: User, badge: null }
      ]
    }
  ];

  return (
    <>
      {/* ============================================================== */}
      {/* DESKTOP SIDEBAR: width 230px, glass + var(--side), white text  */}
      {/* ============================================================== */}
      <aside className="hidden md:flex flex-col justify-between w-[230px] min-w-[230px] max-w-[230px] h-screen bg-[var(--side)] backdrop-blur-2xl border-r border-edge p-4 flex-shrink-0 select-none shadow-2xl z-30 text-white overflow-y-auto scrollbar-thin">
        <div>
          {/* Logo & Workspace Name */}
          <div
            onClick={() => navigate('/chats')}
            className="flex items-center gap-2.5 px-1 py-2 mb-4 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#f0735f] to-[#d9503f] text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-base tracking-tight text-white truncate">
                  Flash Chat
                </span>
              </div>
              <p className="text-[10px] text-white/70 font-medium truncate uppercase tracking-wider">
                Workspace
              </p>
            </div>
          </div>

          {/* Search Pill with ⌘K */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white/80 hover:text-white text-xs font-medium transition mb-5 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-white/80" />
              <span>Search...</span>
            </div>
            <kbd className="text-[10px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded border border-white/20">
              ⌘K
            </kbd>
          </button>

          {/* Nav Groups: MAIN / WORKSPACE / SYSTEM */}
          <div className="space-y-4">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {grp.group}
                </div>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-white text-[#4a2a22] shadow-md font-bold'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon
                              className={`w-4 h-4 flex-shrink-0 ${
                                isActive ? 'text-[#d9503f] stroke-[2.5px]' : 'text-white/80'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                item.isAlert
                                  ? 'bg-[#d9503f] text-white shadow-xs'
                                  : isActive
                                  ? 'bg-[#f0735f]/15 text-[#d9503f]'
                                  : 'bg-white/20 text-white'
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
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section: Theme & User Profile */}
        <div className="pt-3 border-t border-white/15 space-y-2 mt-4">
          {/* Appearance Toggle */}
          <div className="flex items-center justify-between px-2 text-xs text-white/70">
            <span className="text-[11px] font-medium">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* User Mini Profile */}
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center justify-between p-2 rounded-2xl bg-white/10 hover:bg-white/15 transition cursor-pointer border border-white/15"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                src={user?.avatar}
                alt={user?.name || 'User'}
                size="sm"
                isOnline={Boolean(user)}
                showStatus
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {user?.name || 'Flash User'}
                </p>
                <p className="text-[10px] text-white/70 truncate">
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
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MOBILE TOP BAR: "Mobile pe horizontal top bar ban jaye"        */}
      {/* ============================================================== */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-[var(--side)] backdrop-blur-xl border-b border-edge text-white z-30 shadow-md">
        <div
          onClick={() => navigate('/chats')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f0735f] to-[#d9503f] flex items-center justify-center text-white font-black text-sm shadow-xs">
            ⚡
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white">
              Flash Chat
            </span>
            <span className="text-[10px] text-white/70 ml-1.5 uppercase font-bold tracking-wider">
              Workspace
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition cursor-pointer"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>
          <div onClick={() => navigate('/profile')} className="cursor-pointer">
            <Avatar src={user?.avatar} alt={user?.name} size="xs" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
