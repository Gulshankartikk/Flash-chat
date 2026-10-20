import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, User, UserPlus, ChevronRight, Check, X, Sparkles, BookUser, Phone } from 'lucide-react';
import { Modal } from '../Modal';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Input } from '../Input';
import api from '../../services/api';
import { useChatStore } from '../../store/useChatStore';
import { useContactsStore } from '../../features/contacts/useContacts';
import { AddContactModal } from '../../features/contacts/AddContactModal';
import {
  isPossiblePhoneNumber,
  formatToE164,
  formatDisplayPhone,
  getDefaultCountryCode
} from '../../features/contacts/phoneUtils';

export const NewChatModal = ({ isOpen, onClose, onChatCreated }) => {
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add Contact Modal sub-state
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [prefilledPhone, setPrefilledPhone] = useState('');

  // Group state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const navigate = useNavigate();
  const { startDirectConversation, createGroup } = useChatStore();
  const { contacts, fetchContacts, startChatWithContact } = useContactsStore();

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    } else {
      setSearchQuery('');
      setUserResults([]);
      setGroupName('');
      setGroupDescription('');
      setSelectedUserIds([]);
    }
  }, [isOpen, fetchContacts]);

  // Phone number query detection
  const isPhoneQuery = useMemo(() => {
    return isPossiblePhoneNumber(searchQuery);
  }, [searchQuery]);

  const formattedPhoneSuggestion = useMemo(() => {
    if (!isPhoneQuery) return null;
    const e164 = formatToE164(searchQuery, getDefaultCountryCode());
    return {
      raw: searchQuery,
      e164,
      display: formatDisplayPhone(e164)
    };
  }, [isPhoneQuery, searchQuery]);

  // Search users
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || isPhoneQuery) {
      setUserResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
        setUserResults(res.data.users || []);
      } catch (err) {
        setUserResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isPhoneQuery]);

  const handleStartDirect = async (userId) => {
    try {
      const conv = await startDirectConversation(userId);
      onClose();
      if (onChatCreated) onChatCreated(conv);
    } catch (err) {
      alert(err.message || 'Failed to start chat');
    }
  };

  const handleContactClick = async (c) => {
    const isLinked = Boolean(c.linkedUser);
    const uId = c.linkedUser?._id || c.linkedUser;
    if (isLinked && uId) {
      return handleStartDirect(uId);
    }

    try {
      setIsLoading(true);
      const conv = await startChatWithContact(c._id);
      onClose();
      if (conv?._id) {
        if (onChatCreated) onChatCreated(conv);
        else navigate(`/chats/${conv._id}`);
      } else if (conv?.conversationId) {
        if (onChatCreated) onChatCreated({ _id: conv.conversationId });
        else navigate(`/chats/${conv.conversationId}`);
      } else {
        navigate('/chats');
      }
    } catch (err) {
      if (c.phone) {
        handleStartPhoneChat(c.phone);
      } else {
        alert(err.response?.data?.message || err.message || 'Could not start chat');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPhoneChat = (phoneString) => {
    setPrefilledPhone(phoneString);
    setIsAddContactOpen(true);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && formattedPhoneSuggestion) {
      e.preventDefault();
      handleStartPhoneChat(formattedPhoneSuggestion.e164);
    }
  };

  const handleToggleGroupMember = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUserIds.length === 0) return;

    setIsCreatingGroup(true);
    try {
      const conv = await createGroup({
        name: groupName.trim(),
        memberIds: selectedUserIds,
        description: groupDescription.trim()
      });
      onClose();
      if (onChatCreated) onChatCreated(conv);
    } catch (err) {
      alert(err.message || 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Contacts sorted A-Z
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [contacts]);

  return (
    <>
      <Modal
        isOpen={isOpen && !isAddContactOpen}
        onClose={onClose}
        title={activeTab === 'direct' ? 'New Chat' : 'Create a New Group'}
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5">
          {/* Direct Tab / Search / Top Action Rows */}
          {activeTab === 'direct' ? (
            <div className="space-y-3">
              {/* Search Box */}
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search name, number or @username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-line bg-cream/30 text-xs font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
                />
              </div>

              {/* Action Buttons: New Group & New Contact (Matches Screenshot) */}
              {!searchQuery.trim() && (
                <div className="space-y-1.5 pt-1">
                  {/* New Group */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('group')}
                    className="w-full flex items-center gap-3.5 p-2 rounded-xl hover:bg-orange-50/60 transition cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#22C55E] text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                        New group
                      </p>
                    </div>
                  </button>

                  {/* New Contact */}
                  <button
                    type="button"
                    onClick={() => {
                      setPrefilledPhone('');
                      setIsAddContactOpen(true);
                    }}
                    className="w-full flex items-center gap-3.5 p-2 rounded-xl hover:bg-orange-50/60 transition cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#22C55E] text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                        New contact
                      </p>
                    </div>
                  </button>
                </div>
              )}


              {/* Dynamic Phone Number Result Row */}
              {formattedPhoneSuggestion && (
                <div className="pt-1">
                  <div
                    onClick={() => handleStartPhoneChat(formattedPhoneSuggestion.e164)}
                    className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/10 via-secondary/10 to-transparent border border-primary/30 hover:border-primary cursor-pointer transition shadow-xs group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-xs">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink group-hover:text-primary transition-colors">
                          Chat with {formattedPhoneSuggestion.display}
                        </p>
                        <p className="text-[10px] text-muted">Press Enter or tap to start chat</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary" />
                  </div>
                </div>
              )}

              {/* Results / Contacts List */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {isLoading ? (
                  <div className="p-4 text-center text-xs text-muted animate-pulse">
                    Searching users...
                  </div>
                ) : userResults.length > 0 ? (
                  userResults.map((u) => (
                    <div
                      key={u._id}
                      onClick={() => handleStartDirect(u._id)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-orange-50/40 transition cursor-pointer border border-transparent hover:border-line"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar src={u.avatar} name={u.name} size="sm" isOnline={u.isOnline} showStatus />
                        <div>
                          <p className="text-xs font-bold text-ink">{u.name}</p>
                          <p className="text-[10px] text-muted">@{u.username}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-md">
                        Chat
                      </span>
                    </div>
                  ))
                ) : searchQuery.trim() && !formattedPhoneSuggestion ? (
                  <p className="p-4 text-center text-xs text-muted">No users found.</p>
                ) : sortedContacts.length > 0 && !searchQuery.trim() ? (
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider px-1 mb-1 flex items-center gap-1">
                      <BookUser className="w-3 h-3 text-primary" />
                      <span>Contacts (A-Z)</span>
                    </p>
                    {sortedContacts.map((c) => {
                      const isLinked = Boolean(c.linkedUser);
                      return (
                        <div
                          key={c._id}
                          onClick={() => handleContactClick(c)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-orange-50/40 transition cursor-pointer border border-transparent hover:border-line"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar src={c.avatar || c.linkedUser?.avatar} name={c.name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-ink truncate">{c.name}</p>
                              <p className="text-[10px] text-muted truncate">
                                {c.linkedUser?.username ? `@${c.linkedUser.username}` : c.phone || c.email}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              isLinked
                                ? 'text-primary bg-primary/15'
                                : 'text-muted bg-cream border border-line'
                            }`}
                          >
                            {isLinked ? 'Chat' : 'Invite'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            /* Group Creation Form */
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-line">
                <span className="text-xs font-bold text-ink">New Group Details</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('direct')}
                  className="text-xs text-primary font-bold hover:underline cursor-pointer"
                >
                  Back to 1:1 Chat
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g. Product Launch Team"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-cream/40 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Group Description (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Purpose of this group..."
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-line bg-cream/40 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
                />
              </div>

              {/* Member Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-ink">
                    Add Members ({selectedUserIds.length} selected)
                  </label>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 border border-line rounded-xl p-2 bg-cream/20">
                  {(userResults.length > 0
                    ? userResults
                    : sortedContacts
                        .filter((c) => c.linkedUser)
                        .map((c) => ({
                          _id: c.linkedUser?._id || c.linkedUser,
                          name: c.name,
                          username: c.linkedUser?.username || '',
                          avatar: c.avatar
                        }))
                  ).map((u) => {
                    if (!u._id) return null;
                    const isSelected = selectedUserIds.includes(u._id);
                    return (
                      <div
                        key={u._id}
                        onClick={() => handleToggleGroupMember(u._id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                          isSelected ? 'bg-primary/15 border border-line' : 'hover:bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar src={u.avatar} name={u.name} size="xs" />
                          <span className="text-xs font-medium text-ink">{u.name}</span>
                          {u.username && <span className="text-[10px] text-muted">@{u.username}</span>}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-primary rounded border-line"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isCreatingGroup}
                disabled={!groupName.trim() || selectedUserIds.length === 0}
                className="w-full py-2.5"
              >
                Create Group Room
              </Button>
            </form>
          )}
        </div>
      </Modal>

      {/* Embedded AddContactModal for direct phone flow */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => {
          setIsAddContactOpen(false);
          setPrefilledPhone('');
        }}
        initialPhone={prefilledPhone}
        onChatReady={(conversationId) => {
          setIsAddContactOpen(false);
          setPrefilledPhone('');
          onClose();
          if (onChatCreated) onChatCreated({ _id: conversationId });
        }}
      />
    </>
  );
};

export default NewChatModal;
