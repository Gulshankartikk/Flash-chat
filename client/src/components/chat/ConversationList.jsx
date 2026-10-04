import React, { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Search,
  Plus,
  Pin,
  VolumeX,
  Archive,
  MessageSquare,
  Users,
  Check,
  CheckCheck,
  Phone,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CallHistoryList } from '../../features/calls';

export const ConversationList = ({ onSelectConversation, onOpenNewChat }) => {
  const { conversations, activeConversation } = useChatStore();
  const { user } = useAuthStore();

  const [activeSection, setActiveSection] = useState('chats'); // 'chats' | 'calls'
  const [searchFilter, setSearchFilter] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'groups' | 'support' | 'archived'

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'M/d/yy');
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const title = c.contactName || c.displayName || c.name || '';
    const nameMatch = title.toLowerCase().includes(searchFilter.toLowerCase().trim());
    if (!nameMatch) return false;

    if (filterTab === 'archived') return c.isArchived;
    if (c.isArchived) return false;

    if (filterTab === 'unread') return (c.unreadCount || 0) > 0;
    if (filterTab === 'groups') return c.type === 'group';
    if (filterTab === 'support') return c.type === 'support';

    return true;
  });

  // Pinned vs Normal
  const pinnedConversations = filteredConversations.filter((c) => c.isPinned && !c.isArchived);
  const regularConversations = filteredConversations.filter((c) => !c.isPinned);

  const getMessageSnippet = (msg) => {
    if (!msg) return 'No messages yet';
    if (msg.deletedForEveryone) return '🚫 This message was deleted';
    if (msg.type === 'shared_post') return 'Shared a post';
    if (msg.type === 'shared_reel') return 'Shared a reel';
    if (msg.type === 'shared_story') {
      return msg.text ? 'Replied to a story' : 'Shared a story';
    }
    if (msg.type === 'shared_profile') return 'Shared a profile';
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'video') return '🎥 Video';
    if (msg.type === 'voice') return '🎤 Voice memo';
    if (msg.type === 'audio') return '🎵 Audio note';
    if (msg.type === 'location') return '📍 Location';
    if (msg.type === 'contact') return '👤 Contact';
    if (msg.type === 'document') return '📄 Document';
    if (msg.type === 'ai') return '⚡ Flash AI Reply';
    return msg.text || 'Attachment';
  };

  const renderConversationItem = (conv) => {
    const isSelected = activeConversation && String(activeConversation._id) === String(conv._id);
    const isOnline = conv.type === 'direct' ? conv.otherUser?.isOnline : false;
    const isSupport = conv.type === 'support';
    const title = isSupport ? 'Flash Support' : (conv.contactName || conv.displayName || conv.name || 'Chat');

    return (
      <div
        key={conv._id}
        onClick={() => onSelectConversation(conv)}
        className={`flex items-center gap-3 p-3.5 hover:bg-orange-50/40 transition cursor-pointer relative ${
          isSelected ? 'bg-orange-50/70 border-l-4 border-l-primary' : ''
        }`}
      >
        {/* Avatar */}
        {isSupport ? (
          <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            ⚡
          </div>
        ) : (
          <Avatar
            src={conv.displayAvatar}
            name={title}
            size="md"
            isOnline={isOnline}
            showStatus={conv.type === 'direct'}
          />
        )}

        {/* Body Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-ink truncate flex items-center gap-1">
              <span>{title}</span>
              {isSupport && (
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              {conv.isMuted && <VolumeX className="w-3 h-3 text-muted shrink-0" />}
            </h4>
            <span className="text-[10px] text-muted shrink-0">
              {formatMessageTime(conv.lastMessage?.createdAt || conv.updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted truncate max-w-[180px]">
              {getMessageSnippet(conv.lastMessage)}
            </p>

            <div className="flex items-center gap-1.5 shrink-0">
              {conv.isPinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
              {isSupport && (
                <span className="px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                  Support
                </span>
              )}
              {conv.unreadCount > 0 && (
                <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-accent text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-line w-full md:w-80 lg:w-96 select-none shrink-0">
      {/* Header Bar */}
      <div className="p-4 border-b border-line space-y-3">
        {/* Chats | Calls Switcher */}
        <div className="flex items-center gap-1 p-1 bg-cream rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setActiveSection('chats')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === 'chats'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chats ({conversations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('calls')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === 'calls'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Calls</span>
          </button>
        </div>

        {activeSection === 'chats' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-ink tracking-tight">
                Messages
              </h2>

              <button
                type="button"
                onClick={onOpenNewChat}
                className="p-1.5 rounded-xl bg-brand text-white shadow-md shadow-primary/25 hover:brightness-105 transition cursor-pointer"
                title="Start new chat or group"
              >
                <Plus className="w-4 h-4 stroke-[2.5px]" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-primary" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-cream/40 text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
              />
            </div>

            {/* Quick Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-semibold no-scrollbar">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'groups', label: 'Groups' },
                { id: 'support', label: 'Support' },
                { id: 'archived', label: 'Archived' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1 rounded-full transition cursor-pointer shrink-0 ${
                    filterTab === tab.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-cream text-muted hover:text-ink border border-line/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Main Body */}
      {activeSection === 'calls' ? (
        <CallHistoryList />
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-line/30">
          {/* Pinned Section */}
          {pinnedConversations.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-4 py-1.5 bg-cream/60 text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Pin className="w-3 h-3 fill-primary" />
                <span>Pinned</span>
              </div>
              {pinnedConversations.map(renderConversationItem)}
            </div>
          )}

          {/* Regular / Filtered List */}
          {regularConversations.length > 0 ? (
            regularConversations.map(renderConversationItem)
          ) : pinnedConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted space-y-2">
              <MessageSquare className="w-8 h-8 text-line mx-auto mb-2" />
              <p className="font-semibold text-ink">No conversations found</p>
              <p className="text-[11px]">Start a new chat to begin messaging.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ConversationList;
