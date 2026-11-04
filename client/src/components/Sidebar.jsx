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

  const unreadChatCount = conversations?.reduce((acc, c) => acc + (c.unreadCount || 0), 0) || 0;

  React.useEffect(() => {
    const handlePocketSaved = () => setHasPocketNotification(true);
    window.addEventListener('pocket_item_saved', handlePocketSaved);
    return () => window.removeEventListener('pocket_item_saved', handlePocketSaved);
  }, []);

  const navItems = [
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
      badge: unreadNotificationsCount > 0 ? (unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount) : null,
      isAlert: unreadNotificationsCount > 0
    },
    {
      label: 'Pocket',
      path: '/pocket',
      icon: Bookmark,
      badge: hasPocketNotification ? 'Saved' : null,
      isAlert: hasPocketNotification
    },
    { label: 'Flash AI', path: '/ai', icon: Sparkles, badge: 'AI' },
    { label: 'Contacts', path: '/contacts', icon: Users, badge: null },
    { label: 'Help & Support', path: '/support', icon: LifeBuoy, badge: null },
    { label: 'My Profile', path: '/profile', icon: User, badge: null }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="hidden md:flex flex-col justify-between w-64 h-screen bg-card border-r border-line p-4 flex-shrink-0 select-none shadow-soft z-30">
      {/* Brand & Search Top Section */}
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-black text-xl shadow-soft flex-shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-ink">
                Flash Chat
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cream text-primary border border-line">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-muted">Messaging & Social Super-App</p>
          </div>
        </div>

        {/* Global Search Button */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line bg-cream/70 hover:bg-cream text-muted hover:text-ink text-xs font-medium transition mb-5 cursor-pointer shadow-soft focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <span>Search users, tags...</span>
          </div>
          <kbd className="text-[10px] font-semibold bg-card px-1.5 py-0.5 rounded border border-line text-muted">
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
                      ? 'bg-cream text-primary border border-line shadow-soft'
                      : 'text-muted hover:text-ink hover:bg-cream/60'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 ${
                          isActive ? 'text-primary stroke-[2.5px]' : 'text-muted'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.isAlert
                            ? 'bg-accent text-white shadow-soft'
                            : 'bg-cream text-primary border border-line'
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
      <div className="pt-4 border-t border-line space-y-3">
        {/* Theme and quick settings */}
        <div className="flex items-center justify-between px-2 text-xs text-muted">
          <span>Appearance</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-line hover:bg-cream text-ink transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            title="Toggle Light/Dark Theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* User Mini Profile */}
        <div
          onClick={() => navigate('/profile')}
          className="flex items-center justify-between p-2 rounded-2xl hover:bg-cream transition cursor-pointer border border-transparent hover:border-line"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              src={user?.avatar}
              alt={user?.name || 'User'}
              size="sm"
              isOnline={Boolean(user)}
              showStatus
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink truncate">
                {user?.name || 'Flash User'}
              </p>
              <p className="text-[11px] text-muted truncate">
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
            className="p-2 rounded-xl text-muted hover:text-accent hover:bg-accent/10 transition focus:outline-none focus:ring-2 focus:ring-accent"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
