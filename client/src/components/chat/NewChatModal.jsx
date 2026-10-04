import React, { useState, useEffect } from 'react';
import { Search, Users, User, Check, X, Sparkles, BookUser } from 'lucide-react';
import { Modal } from '../Modal';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Input } from '../Input';
import api from '../../services/api';
import { useChatStore } from '../../store/useChatStore';
import { useContactsStore } from '../../features/contacts/useContacts';

export const NewChatModal = ({ isOpen, onClose, onChatCreated }) => {
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Group state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const { startDirectConversation, createGroup } = useChatStore();
  const { contacts, fetchContacts } = useContactsStore();

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

  // Search users
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
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
  }, [searchQuery]);

  const handleStartDirect = async (userId) => {
    try {
      const conv = await startDirectConversation(userId);
      onClose();
      if (onChatCreated) onChatCreated(conv);
    } catch (err) {
      alert(err.message || 'Failed to start chat');
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

  const linkedContacts = contacts.filter((c) => c.linkedUser);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeTab === 'direct' ? 'Start a New Chat' : 'Create a New Group'}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Tab Switcher */}
        <div className="flex p-1 bg-cream rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'direct'
                ? 'bg-card text-ink shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <User className="w-3.5 h-3.5 text-primary" />
            <span>1:1 Direct Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('group')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'group'
                ? 'bg-card text-ink shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-secondary" />
            <span>New Group Room</span>
          </button>
        </div>

        {activeTab === 'direct' ? (
          /* Direct Chat Search & Select */
          <div className="space-y-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-primary pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Search user by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-cream/40 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
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
              ) : searchQuery.trim() ? (
                <p className="p-4 text-center text-xs text-muted">No users found.</p>
              ) : linkedContacts.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider px-1 mb-1 flex items-center gap-1">
                    <BookUser className="w-3 h-3 text-primary" />
                    <span>Saved Contacts on Flash Chat</span>
                  </p>
                  {linkedContacts.map((c) => {
                    const uId = c.linkedUser?._id || c.linkedUser;
                    return (
                      <div
                        key={c._id}
                        onClick={() => handleStartDirect(uId)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-orange-50/40 transition cursor-pointer border border-transparent hover:border-line"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar src={c.avatar || c.linkedUser?.avatar} name={c.name} size="sm" />
                          <div>
                            <p className="text-xs font-bold text-ink">{c.name}</p>
                            <p className="text-[10px] text-muted">
                              {c.linkedUser?.username ? `@${c.linkedUser.username}` : c.phone || c.email}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-md">
                          Message
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-4 text-center text-xs text-muted">
                  Type a name or username above to find someone.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Group Creation Form */
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Group Name *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Product Launch Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-cream/40 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
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

            {/* Member Search & Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink">
                  Add Members ({selectedUserIds.length} selected)
                </label>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-primary" />
                <input
                  type="text"
                  placeholder="Search users to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-line bg-cream/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 border border-line rounded-xl p-2 bg-cream/20">
                {(userResults.length > 0
                  ? userResults
                  : linkedContacts.map((c) => ({
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
  );
};

export default NewChatModal;
