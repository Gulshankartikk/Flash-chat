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
  Phone
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CallHistoryList } from '../../features/calls';

export const ConversationList = ({ onSelectConversation, onOpenNewChat }) => {
  const { conversations, activeConversation, updateChatSettings } = useChatStore();
  const { user } = useAuthStore();

  const [activeSection, setActiveSection] = useState('chats'); // 'chats' | 'calls'
  const [searchFilter, setSearchFilter] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'groups' | 'archived'

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'M/d/yy');
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Search query filter
    const nameMatch = (c.displayName || c.name || '')
      .toLowerCase()
      .includes(searchFilter.toLowerCase().trim());
    if (!nameMatch) return false;

    // Tab filter
    if (filterTab === 'archived') return c.isArchived;
    if (c.isArchived) return false; // Hide archived from standard tabs

    if (filterTab === 'unread') return (c.unreadCount || 0) > 0;
    if (filterTab === 'groups') return c.type === 'group';

    return true;
  });

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
    return msg.text || 'Attachment';
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-[#FED7AA] w-full md:w-80 lg:w-96 select-none flex-shrink-0">
      {/* Header Bar */}
      {/* Header Bar */}
      <div className="p-4 border-b border-[#FED7AA] space-y-3">
        {/* Chats | Calls Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#FFF7ED] rounded-xl border border-[#FED7AA]">
          <button
            type="button"
            onClick={() => setActiveSection('chats')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === 'chats'
                ? 'bg-white text-[#F97316] shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
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
                ? 'bg-white text-[#F97316] shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Calls</span>
          </button>
        </div>

        {activeSection === 'chats' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#1F2937] tracking-tight">
                Messages
              </h2>

              <button
                type="button"
                onClick={onOpenNewChat}
                className="p-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white shadow-md shadow-orange-500/25 transition cursor-pointer"
                title="Start new chat or group"
              >
                <Plus className="w-4 h-4 stroke-[2.5px]" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#F97316]" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs text-[#1F2937] placeholder-[#6B7280]/60 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:bg-white transition"
              />
            </div>

            {/* Quick Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-semibold">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'groups', label: 'Groups' },
                { id: 'archived', label: 'Archived' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1 rounded-full transition cursor-pointer flex-shrink-0 ${
                    filterTab === tab.id
                      ? 'bg-[#F97316] text-white shadow-sm'
                      : 'bg-[#FFF7ED] text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Main Body: Calls History or Conversations List */}
      {activeSection === 'calls' ? (
        <CallHistoryList />
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-[#FED7AA]/30">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => {
            const isSelected = activeConversation && String(activeConversation._id) === String(conv._id);
            const isOnline = conv.type === 'direct' ? conv.otherUser?.isOnline : false;

            return (
              <div
                key={conv._id}
                onClick={() => onSelectConversation(conv)}
                className={`flex items-center gap-3 p-3.5 hover:bg-[#FFF7ED]/70 transition cursor-pointer relative ${
                  isSelected ? 'bg-[#FFF7ED] border-l-4 border-l-[#F97316]' : ''
                }`}
              >
                {/* Avatar */}
                <Avatar
                  src={conv.displayAvatar}
                  alt={conv.displayName}
                  size="md"
                  isOnline={isOnline}
                  showStatus={conv.type === 'direct'}
                />

                {/* Body Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#1F2937] truncate flex items-center gap-1">
                      <span>{conv.displayName}</span>
                      {conv.isMuted && <VolumeX className="w-3 h-3 text-[#6B7280]" />}
                    </h4>
                    <span className="text-[10px] text-[#6B7280] flex-shrink-0">
                      {formatMessageTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-[#6B7280] truncate max-w-[180px]">
                      {getMessageSnippet(conv.lastMessage)}
                    </p>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {conv.isPinned && <Pin className="w-3 h-3 text-[#F97316] fill-[#F97316]" />}
                      {conv.unreadCount > 0 && (
                        <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-[#6B7280] space-y-2">
            <MessageSquare className="w-8 h-8 text-[#FED7AA] mx-auto mb-2" />
            <p className="font-semibold text-[#1F2937]">No conversations found</p>
            <p className="text-[11px]">Start a new chat to begin messaging.</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default ConversationList;
