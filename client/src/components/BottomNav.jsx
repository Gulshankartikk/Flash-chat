import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, Flame, Bookmark, Sparkles, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSocialStore } from '../features/social/store/useSocialStore';
import { Avatar } from './Avatar';

export const BottomNav = () => {
  const { user } = useAuthStore();
  const { unreadNotificationsCount } = useSocialStore();
  const [hasPocketNotification, setHasPocketNotification] = React.useState(false);

  React.useEffect(() => {
    const handlePocketSaved = () => setHasPocketNotification(true);
    window.addEventListener('pocket_item_saved', handlePocketSaved);
    return () => window.removeEventListener('pocket_item_saved', handlePocketSaved);
  }, []);

  const navItems = [
    { label: 'Chats', path: '/chats', icon: MessageSquare },
    { label: 'Social', path: '/social', icon: Flame },
    { label: 'Pocket', path: '/pocket', icon: Bookmark },
    { label: 'Flash AI', path: '/ai', icon: Sparkles },
    {
      label: 'Profile',
      path: '/profile',
      icon: User,
      customIcon: user?.avatar ? (
        <Avatar src={user.avatar} alt={user.name} size="xs" />
      ) : null
    }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-line px-2 py-1.5 shadow-soft safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (item.label === 'Pocket') setHasPocketNotification(false);
              }}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition duration-150 relative ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    {item.customIcon ? (
                      <div className={`p-0.5 rounded-full ${isActive ? 'ring-2 ring-primary' : ''}`}>
                        {item.customIcon}
                      </div>
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    )}
                    {item.label === 'Social' && unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-card">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </span>
                    )}
                    {item.label === 'Pocket' && hasPocketNotification && (
                      <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-brand-gradient ring-2 ring-card animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-brand-gradient" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
