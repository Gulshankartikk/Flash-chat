import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Users,
  Moon,
  Sun,
  LogOut,
  User,
  Settings,
  MessageSquare
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useDebounce } from '../../hooks/useDebounce';
import { CreateGroupModal } from './CreateGroupModal';
import { UserProfileModal } from './UserProfileModal';

export const ChatSidebar = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const {
    chats,
    activeChat,
    setActiveChat,
    searchResults,
    searchUsers,
    isSearching,
    createPrivateChat,
    onlineUsers
  } = useChatStore();

  useEffect(() => {
    if (debouncedSearch) {
      searchUsers(debouncedSearch);
    }
  }, [debouncedSearch, searchUsers]);

  const handleSelectUser = async (targetUser) => {
    setSearchQuery('');
    await createPrivateChat(targetUser._id);
  };

  // Helper to extract chat title, avatar, and presence
  const getChatMeta = (chat) => {
    if (chat.isGroup) {
      return {
        name: chat.name,
        avatar: chat.avatar,
        isOnline: false,
        isGroup: true
      };
    }

    const otherParticipant = chat.participants?.find((p) => p._id !== user?._id);
    const isOnline = otherParticipant ? onlineUsers.has(otherParticipant._id) : false;

    return {
      name: otherParticipant?.name || 'Private Chat',
      avatar: otherParticipant?.avatar,
      isOnline,
      isGroup: false
    };
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full select-none">
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <span className="font-extrabold text-sm">⚡</span>
          </div>
          <h1 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-slate-100">
            Flash Chat
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Create group chat"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle Dark / Light Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Quick Profile Modal"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search users or messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Main List Area: Search Results or Recent Chats */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {searchQuery ? (
          <div>
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Users Found
            </p>
            {isSearching ? (
              <p className="text-xs text-center py-6 text-slate-400">Searching...</p>
            ) : searchResults.length > 0 ? (
              searchResults.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleSelectUser(u)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                >
                  <Avatar
                    src={u.avatar}
                    name={u.name}
                    size="md"
                    isOnline={onlineUsers.has(u._id)}
                    showStatus
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {u.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{u.bio || u.email}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-center py-6 text-slate-400">No users found.</p>
            )}
          </div>
        ) : (
          <div>
            {chats.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  No conversations yet
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Search a user above to start your first chat!
                </p>
              </div>
            ) : (
              chats.map((chat) => {
                const meta = getChatMeta(chat);
                const isActive = activeChat?._id === chat._id;
                const unreadCount =
                  chat.unreadCounts && user?._id
                    ? chat.unreadCounts[user._id] || 0
                    : 0;

                return (
                  <button
                    key={chat._id}
                    onClick={() => setActiveChat(chat)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Avatar
                      src={meta.avatar}
                      name={meta.name}
                      size="md"
                      isOnline={meta.isOnline}
                      showStatus={!meta.isGroup}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                          {meta.name}
                        </p>
                        {chat.latestMessage?.createdAt && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(chat.latestMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                          {chat.latestMessage?.isDeleted
                            ? 'Message deleted'
                            : chat.latestMessage?.content ||
                              (chat.latestMessage?.mediaUrl ? '📎 Attachment' : 'No messages yet')}
                        </p>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-sm">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* User Footer Profile strip */}
      <button
        onClick={() => navigate('/settings')}
        className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition text-left w-full cursor-pointer"
        title="Account Settings"
      >
        <Avatar src={user?.avatar} name={user?.name} size="sm" isOnline showStatus />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            {user?.name}
          </p>
          <p className="text-[10px] text-emerald-500 font-medium">Online • Settings</p>
        </div>
        <Settings className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
      </button>

      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
      />
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </aside>
  );
};
