import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, Flame, Bookmark, Sparkles, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSocialStore } from '../features/social/store/useSocialStore';
import { Avatar } from './Avatar';

export const BottomNav = () => {
  const { user } = useAuthStore();
  const { unreadNotificationsCount } = useSocialStore();

  const navItems = [
    { label: 'Chats', path: '/chats', icon: MessageSquare },
    { label: 'Social', path: '/social', icon: Flame },
    { label: 'Pocket', path: '/pocket', icon: Bookmark },
    { label: 'AI', path: '/ai', icon: Sparkles },
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#FED7AA] px-2 py-1.5 shadow-lg">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition duration-150 relative ${
                  isActive
                    ? 'text-[#F97316] font-bold'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    {item.customIcon ? (
                      <div className={`p-0.5 rounded-full ${isActive ? 'ring-2 ring-[#F97316]' : ''}`}>
                        {item.customIcon}
                      </div>
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    )}
                    {item.label === 'Social' && unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-[#F43F5E] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899]" />
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
