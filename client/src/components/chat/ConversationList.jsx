import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Clock,
  UserPlus,
  ChevronRight,
  Inbox,
  BookUser,
  Star
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useContactsStore } from '../../features/contacts/useContacts';
import { CallHistoryList } from '../../features/calls';
import { StoriesTray } from '../../features/social/components/StoriesTray';
import { AddContactModal } from '../../features/contacts/AddContactModal';
import { getDisplayName } from '../../utils/getDisplayName';

export const ConversationList = ({
  onSelectConversation,
  onOpenNewChat,
  onSelectPending
}) => {
  const {
    conversations,
    activeConversation,
    pendingConversations,
    fetchPendingConversations,
    onlineUsers,
    updateChatSettings,
    startDirectConversation
  } = useChatStore();
  const { user } = useAuthStore();
  const { contacts, fetchContacts, startChatWithContact } = useContactsStore();

  const [activeSection, setActiveSection] = useState('chats'); // 'chats' | 'stories' | 'calls'
  const [searchFilter, setSearchFilter] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'online' | 'contacts' | 'groups' | 'requests' | 'support' | 'archived'
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPendingConversations();
      fetchContacts();
    }
  }, [user, fetchPendingConversations, fetchContacts]);

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'M/d/yy');
  };

  const currentUserId = user?._id ? String(user._id) : '';

  // Incoming Message Requests (only for recipient, where current user is not the requester)
  const messageRequests = conversations.filter(
    (c) => c.status === 'request' && String(c.requestedBy || '') !== currentUserId
  );

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // If viewing requests filter, only show incoming requests
    if (filterTab === 'requests') return c.status === 'request' && String(c.requestedBy || '') !== currentUserId;
    // In normal views, only incoming message requests are hidden into their dedicated top section
    if (c.status === 'request' && String(c.requestedBy || '') !== currentUserId) return false;

    const title = c.contactName || c.displayName || c.name || '';
    const nameMatch = title.toLowerCase().includes(searchFilter.toLowerCase().trim());
    if (!nameMatch) return false;

    if (filterTab === 'archived') return c.isArchived;
    if (c.isArchived) return false;

    if (filterTab === 'unread') return (c.unreadCount || 0) > 0;
    if (filterTab === 'online') {
      const otherUserId = c.otherUser?._id ? String(c.otherUser._id) : null;
      return (
        c.type === 'direct' &&
        otherUserId &&
        ((onlineUsers instanceof Set ? onlineUsers.has(otherUserId) : false) || Boolean(c.otherUser?.isOnline))
      );
    }
    if (filterTab === 'groups') return c.type === 'group';
    if (filterTab === 'support') return c.type === 'support';

    return true;
  });

  // Filter contacts by search query
  const filteredContacts = contacts.filter((c) => {
    const q = searchFilter.toLowerCase().trim().replace(/^@/, '');
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.linkedUser?.username || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  const handleStartChatWithContact = async (contact) => {
    try {
      const linkedId = contact.linkedUser?._id || contact.linkedUser;
      const isSelf =
        (linkedId && String(linkedId) === currentUserId) ||
        (user?.phoneNumber && contact.phone && contact.phone.trim() === user.phoneNumber.trim()) ||
        (user?.email && contact.email && contact.email.toLowerCase().trim() === user.email.toLowerCase().trim());

      if (isSelf && currentUserId) {
        const conv = await startDirectConversation(currentUserId);
        if (conv && onSelectConversation) onSelectConversation(conv);
        return;
      }

      if (linkedId) {
        const conv = await startDirectConversation(linkedId);
        if (conv && onSelectConversation) onSelectConversation(conv);
      } else {
        const res = await startChatWithContact(contact._id);
        const conv = res?.conversation || res;
        if (conv?._id) {
          if (onSelectConversation) onSelectConversation(conv);
        } else if (res?.status === 'pending' || res?.pendingId) {
          if (onSelectPending) onSelectPending(res);
        }
      }
    } catch (err) {
      console.error('Failed to start chat with contact:', err);
    }
  };

  // Pinned vs Regular
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
    const otherUserId = conv.otherUser?._id ? String(conv.otherUser._id) : null;
    const isSelf = conv.isSelf || (conv.type === 'direct' && otherUserId && otherUserId === currentUserId);
    const isOnline = isSelf
      ? true
      : conv.type === 'direct' && otherUserId
      ? (onlineUsers instanceof Set ? onlineUsers.has(otherUserId) : false) || Boolean(conv.otherUser?.isOnline)
      : false;
    const isSupport = conv.type === 'support';
    const isRequest = conv.status === 'request';
    const title = isSupport
      ? 'Flash Support'
      : isSelf
      ? 'You (Message yourself)'
      : (isRequest && conv.otherUser?.name)
      ? conv.otherUser.name
      : (conv.contactName || conv.displayName || conv.name || 'Chat');

    return (
      <div
        key={conv._id}
        onClick={() => onSelectConversation(conv)}
        className={`group flex items-center gap-3 p-3.5 hover:bg-primary/10 transition cursor-pointer relative ${
          isSelected ? 'bg-primary/20 border-l-4 border-l-primary' : ''
        }`}
      >
        {/* Avatar */}
        {isSupport ? (
          <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            ⚡
          </div>
        ) : (
          <Avatar
            src={conv.displayAvatar || conv.otherUser?.avatar}
            name={title}
            size="md"
            isOnline={isOnline}
            showStatus={conv.type === 'direct' && !isRequest}
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
              {isRequest && (
                <span className="px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                  {String(conv.requestedBy || '') === currentUserId ? 'Request Sent' : 'Request'}
                </span>
              )}
              {conv.isMuted && <VolumeX className="w-3 h-3 text-muted shrink-0" />}
            </h4>
            <span className="text-[10px] text-muted shrink-0">
              {formatMessageTime(conv.lastMessage?.createdAt || conv.updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted truncate max-w-[170px]">
              {getMessageSnippet(conv.lastMessage)}
            </p>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick actions on hover */}
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  type="button"
                  title={conv.isPinned ? 'Unpin' : 'Pin'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateChatSettings(conv._id, { pin: !conv.isPinned });
                  }}
                  className="p-1 rounded hover:bg-cream text-muted hover:text-primary transition"
                >
                  <Pin className={`w-3 h-3 ${conv.isPinned ? 'fill-primary text-primary' : ''}`} />
                </button>
                <button
                  type="button"
                  title={conv.isMuted ? 'Unmute' : 'Mute'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateChatSettings(conv._id, {
                      muteUntil: conv.isMuted ? null : new Date(Date.now() + 7 * 86400000).toISOString()
                    });
                  }}
                  className="p-1 rounded hover:bg-cream text-muted hover:text-primary transition"
                >
                  <VolumeX className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title={conv.isArchived ? 'Unarchive' : 'Archive'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateChatSettings(conv._id, { archive: !conv.isArchived });
                  }}
                  className="p-1 rounded hover:bg-cream text-muted hover:text-primary transition"
                >
                  <Archive className="w-3 h-3" />
                </button>
              </div>

              {conv.isPinned && <Pin className="w-3 h-3 text-primary fill-primary group-hover:hidden" />}
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
        {/* Flash Chat Brand Header & User Profile Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              src={user?.avatar}
              name={user?.name || user?.username || 'User'}
              size="sm"
              isOnline={true}
              showStatus={true}
            />
            <div className="min-w-0">
              <h1 className="text-sm font-black text-ink tracking-tight flex items-center gap-1">
                <span className="text-primary font-black">⚡ Flash Chat</span>
              </h1>
              <p className="text-[10px] text-muted flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span>Active now</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* + Action Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                aria-label="New message options"
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                className="p-1.5 rounded-xl bg-brand-gradient hover:opacity-95 text-white shadow-md shadow-primary/25 transition cursor-pointer"
                title="New chat options"
              >
                <Plus className="w-4 h-4 stroke-[2.5px]" />
              </button>

              {showPlusMenu && (
                <div className="absolute right-0 top-10 z-40 p-1.5 rounded-2xl bg-card border border-line shadow-xl text-xs space-y-1 w-44 animate-scaleUp">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      if (onOpenNewChat) onOpenNewChat('direct');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-primary/10 text-ink transition font-bold flex items-center gap-2.5 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>New chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      if (onOpenNewChat) onOpenNewChat('group');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-primary/10 text-ink transition font-bold flex items-center gap-2.5 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-secondary" />
                    <span>New group</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      setIsAddContactOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-primary/10 text-ink transition font-bold flex items-center gap-2.5 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-accent" />
                    <span>New contact</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chats | Stories | Calls Switcher */}
        <div className="flex items-center gap-1 p-1 bg-cream rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setActiveSection('chats')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
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
            onClick={() => setActiveSection('stories')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              activeSection === 'stories'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-secondary" />
            <span>Stories</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('calls')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
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
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-primary" />
              <input
                type="text"
                placeholder={filterTab === 'contacts' ? "Search saved contacts..." : "Search conversations..."}
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
                { id: 'online', label: 'Online' },
                { id: 'contacts', label: `Contacts (${contacts.length})` },
                ...(messageRequests.length > 0 ? [{ id: 'requests', label: `Requests (${messageRequests.length})` }] : []),
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
      ) : activeSection === 'stories' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Status & Stories</h3>
            <span className="text-[10px] text-muted font-medium">Expires after 24h</span>
          </div>
          <StoriesTray />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-line/30">
          {/* Message Requests Banner (if any exist and not on archived/groups filter) */}
          {messageRequests.length > 0 && filterTab !== 'archived' && filterTab !== 'groups' && filterTab !== 'requests' && (
            <div
              onClick={() => setFilterTab('requests')}
              className="p-3 bg-gradient-to-r from-primary/10 via-secondary/10 to-transparent hover:bg-primary/10 cursor-pointer flex items-center justify-between transition border-b border-line/60"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                  <Inbox className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <span>Message requests</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[9px] font-black">
                      {messageRequests.length}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted">From people not in your contacts</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          )}

          {/* If 'requests' filter tab is active */}
          {filterTab === 'requests' && (
            <div>
              <div className="px-4 py-2 bg-cream/60 text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Inbox className="w-3 h-3" />
                <span>Message Requests ({messageRequests.length})</span>
              </div>
              {messageRequests.map(renderConversationItem)}
            </div>
          )}

          {/* If 'contacts' filter tab is active */}
          {filterTab === 'contacts' && (
            <div className="divide-y divide-line/30">
              <div className="px-4 py-2 bg-cream/60 text-[10px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <BookUser className="w-3 h-3" />
                  <span>Saved Contacts ({filteredContacts.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddContactOpen(true)}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  + Add Contact
                </button>
              </div>

              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted space-y-2">
                  <UserPlus className="w-8 h-8 text-line mx-auto mb-2" />
                  <p className="font-semibold text-ink">No contacts found</p>
                  <p className="text-[11px]">Add friends to your contacts list to message them anytime.</p>
                  <button
                    type="button"
                    onClick={() => setIsAddContactOpen(true)}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition cursor-pointer"
                  >
                    Add Contact
                  </button>
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const linkedUserId = c.linkedUser?._id
                    ? String(c.linkedUser._id)
                    : c.linkedUser
                    ? String(c.linkedUser)
                    : null;
                  const isSelf =
                    (linkedUserId && linkedUserId === currentUserId) ||
                    (user?.phoneNumber && c.phone && c.phone.trim() === user.phoneNumber.trim()) ||
                    (user?.email && c.email && c.email.toLowerCase().trim() === user.email.toLowerCase().trim());
                  const isOnline = isSelf
                    ? true
                    : linkedUserId
                    ? (onlineUsers instanceof Set ? onlineUsers.has(linkedUserId) : false) || Boolean(c.linkedUser?.isOnline)
                    : false;

                  return (
                    <div
                      key={c._id}
                      onClick={() => handleStartChatWithContact(c)}
                      className="flex items-center justify-between p-3.5 hover:bg-primary/10 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={c.avatar || c.linkedUser?.avatar || (isSelf ? user?.avatar : undefined)}
                          name={isSelf ? 'You' : c.name}
                          size="md"
                          isOnline={isOnline}
                          showStatus={Boolean(linkedUserId) || isSelf}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded-full">
                                You
                              </span>
                            )}
                            {c.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                          </p>
                          <p className="text-[10px] text-muted truncate">
                            {isSelf
                              ? 'Message yourself'
                              : c.linkedUser?.username
                              ? `@${c.linkedUser.username}`
                              : c.phone || c.email || 'Saved contact'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartChatWithContact(c);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-[11px] font-bold hover:bg-primary hover:text-white transition cursor-pointer"
                      >
                        Chat
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Waiting to Join (Pending Conversations) Section */}
          {pendingConversations.length > 0 && filterTab === 'all' && (
            <div className="space-y-0.5">
              <div className="px-4 py-1.5 bg-amber-500/10 text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Waiting to join ({pendingConversations.length})</span>
              </div>
              {pendingConversations.map((pending) => {
                const title = getDisplayName(pending, pending.rawPhoneMasked || 'Phone invite');
                const lastMsg = pending.queuedMessages?.[pending.queuedMessages.length - 1];
                const msgText = typeof lastMsg === 'string' ? lastMsg : lastMsg?.text || 'Queued message request';

                return (
                  <div
                    key={pending._id}
                    onClick={() => {
                      if (onSelectPending) {
                        onSelectPending(pending);
                      } else {
                        onSelectConversation({ ...pending, isPending: true });
                      }
                    }}
                    className="flex items-center gap-3 p-3.5 hover:bg-primary/10 transition cursor-pointer relative"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-ink truncate flex items-center gap-1">
                          <span>{title}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-bold">
                            Queued
                          </span>
                        </h4>
                        <span className="text-[10px] text-muted shrink-0">
                          {formatMessageTime(pending.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-muted truncate max-w-[180px]">
                          {msgText}
                        </p>
                        <span className="text-[10px] text-primary font-semibold">
                          {pending.queuedMessages?.length || 0}/5 queued
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pinned Section */}
          {pinnedConversations.length > 0 && filterTab !== 'requests' && filterTab !== 'contacts' && (
            <div className="space-y-0.5">
              <div className="px-4 py-1.5 bg-cream/60 text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Pin className="w-3 h-3 fill-primary" />
                <span>Pinned</span>
              </div>
              {pinnedConversations.map(renderConversationItem)}
            </div>
          )}

          {/* Regular / Filtered List */}
          {filterTab !== 'requests' && filterTab !== 'contacts' && regularConversations.length > 0 ? (
            regularConversations.map(renderConversationItem)
          ) : filterTab !== 'requests' && filterTab !== 'contacts' && pinnedConversations.length === 0 && pendingConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted space-y-2">
              <MessageSquare className="w-8 h-8 text-line mx-auto mb-2" />
              <p className="font-semibold text-ink">
                {filterTab === 'online'
                  ? 'No online chats right now'
                  : filterTab === 'unread'
                  ? 'No unread messages'
                  : 'No conversations found'}
              </p>
              <p className="text-[11px]">
                {filterTab === 'online'
                  ? 'Active users will appear here when online.'
                  : filterTab === 'unread'
                  ? 'All your chats are caught up.'
                  : 'Start a new chat to begin messaging.'}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* WhatsApp-style Floating Action Button (FAB) for New Chat / Add Contact */}
      {activeSection === 'chats' && (
        <div
          className="fixed md:absolute right-5 md:right-6 z-30 pointer-events-none"
          style={{
            bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <button
            type="button"
            aria-label="New chat or contact"
            onClick={() => {
              if (onOpenNewChat) onOpenNewChat('direct');
            }}
            className="pointer-events-auto w-14 h-14 rounded-full bg-brand-gradient hover:opacity-95 text-white shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-primary/40 cursor-pointer"
            title="Start new chat or add contact"
          >
            <MessageSquare className="w-6 h-6 stroke-[2.2px]" />
          </button>
        </div>
      )}

      {/* Add Contact Modal opened from '+' menu */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onChatReady={(conversationId) => {
          setIsAddContactOpen(false);
          if (onSelectConversation) {
            onSelectConversation({ _id: conversationId });
          }
        }}
      />
    </div>
  );
};

export default ConversationList;
