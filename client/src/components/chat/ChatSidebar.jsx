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
  MessageSquare,
  BookUser,
  HelpCircle
} from 'lucide-react';
import { Avatar } from '../Avatar';
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
      name: chat.contactName || otherParticipant?.name || 'Private Chat',
      avatar: otherParticipant?.avatar,
      isOnline,
      isGroup: false
    };
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col bg-card border-r border-line h-full select-none">
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white shadow-md shadow-primary/20">
            <span className="font-extrabold text-sm">⚡</span>
          </div>
          <h1 className="font-black text-lg tracking-tight text-ink">
            Flash Chat
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/contacts')}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-cream transition"
            title="Contacts"
          >
            <BookUser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-cream transition"
            title="Create group chat"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-cream transition"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-cream transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-primary" />
          <input
            type="text"
            placeholder="Search users or messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-line bg-cream/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card text-ink placeholder:text-muted/60 transition"
          />
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {searchQuery ? (
          <div>
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              Users Found
            </p>
            {isSearching ? (
              <p className="text-xs text-center py-6 text-muted">Searching...</p>
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleSelectUser(u)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-50/40 transition text-left"
                >
                  <Avatar
                    src={u.avatar}
                    name={u.name}
                    size="md"
                    isOnline={onlineUsers.has(u._id)}
                    showStatus
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink truncate">
                      {u.name}
                    </p>
                    <p className="text-[11px] text-muted truncate">@{u.username || u.phone}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-center py-6 text-muted">No users found.</p>
            )}
          </div>
        ) : (
          <div>
            {chats && chats.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-8 h-8 text-line mx-auto mb-2" />
                <p className="text-xs font-bold text-ink">
                  No conversations yet
                </p>
                <p className="text-[11px] text-muted mt-1">
                  Search a user above to start your first chat!
                </p>
              </div>
            ) : (
              chats &&
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
                        ? 'bg-orange-50 border-l-4 border-l-primary text-ink'
                        : 'hover:bg-cream text-ink'
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
                        <p className="text-xs font-bold truncate text-ink">
                          {meta.name}
                        </p>
                        {chat.latestMessage?.createdAt && (
                          <span className="text-[10px] text-muted">
                            {new Date(chat.latestMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted truncate max-w-[170px]">
                          {chat.latestMessage?.isDeleted
                            ? 'Message deleted'
                            : chat.latestMessage?.content ||
                              (chat.latestMessage?.mediaUrl ? '📎 Attachment' : 'No messages yet')}
                        </p>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-accent text-white shadow-xs">
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
        onClick={() => navigate('/profile')}
        className="p-3 border-t border-line flex items-center gap-3 bg-cream/50 hover:bg-cream transition text-left w-full cursor-pointer"
        title="Account Settings"
      >
        <Avatar src={user?.avatar} name={user?.name} size="sm" isOnline showStatus />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink truncate">
            {user?.name}
          </p>
          <p className="text-[10px] text-primary font-medium">Online • Profile & Settings</p>
        </div>
        <Settings className="w-4 h-4 text-muted hover:text-ink" />
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

export default ChatSidebar;
