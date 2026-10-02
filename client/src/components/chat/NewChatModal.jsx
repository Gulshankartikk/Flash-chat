import React, { useState, useEffect } from 'react';
import { Search, Users, User, Check, X, Sparkles } from 'lucide-react';
import { Modal } from '../Modal';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Input } from '../Input';
import api from '../../services/api';
import { useChatStore } from '../../store/useChatStore';

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

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setUserResults([]);
      setGroupName('');
      setGroupDescription('');
      setSelectedUserIds([]);
    }
  }, [isOpen]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeTab === 'direct' ? 'Start a New Chat' : 'Create a New Group'}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Tab Switcher */}
        <div className="flex p-1 bg-[#FFF7ED] rounded-xl border border-[#FED7AA]">
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'direct'
                ? 'bg-white text-[#1F2937] shadow-sm'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#F97316]" />
            <span>1:1 Direct Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('group')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'group'
                ? 'bg-white text-[#1F2937] shadow-sm'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#EC4899]" />
            <span>New Group Room</span>
          </button>
        </div>

        {activeTab === 'direct' ? (
          /* Direct Chat Search & Select */
          <div className="space-y-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-[#F97316] pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Search user by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {isLoading ? (
                <div className="p-4 text-center text-xs text-[#6B7280] animate-pulse">
                  Searching users...
                </div>
              ) : userResults.length > 0 ? (
                userResults.map((u) => (
                  <div
                    key={u._id}
                    onClick={() => handleStartDirect(u._id)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FFF7ED] transition cursor-pointer border border-transparent hover:border-[#FED7AA]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={u.avatar} alt={u.name} size="sm" isOnline={u.isOnline} showStatus />
                      <div>
                        <p className="text-xs font-bold text-[#1F2937]">{u.name}</p>
                        <p className="text-[10px] text-[#6B7280]">@{u.username}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#F97316] bg-orange-100 px-2 py-0.5 rounded-md">
                      Chat
                    </span>
                  </div>
                ))
              ) : searchQuery.trim() ? (
                <p className="p-4 text-center text-xs text-[#6B7280]">No users found.</p>
              ) : (
                <p className="p-4 text-center text-xs text-[#6B7280]">
                  Type a name or username above to find someone.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Group Creation Form */
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                Group Name
              </label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Product Launch Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                Group Description (Optional)
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="Purpose of this group..."
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            {/* Member Search & Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#1F2937]">
                  Add Members ({selectedUserIds.length} selected)
                </label>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#F97316]" />
                <input
                  type="text"
                  placeholder="Search users to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 border border-[#FED7AA]/50 rounded-xl p-2 bg-[#FFF7ED]/20">
                {userResults.map((u) => {
                  const isSelected = selectedUserIds.includes(u._id);
                  return (
                    <div
                      key={u._id}
                      onClick={() => handleToggleGroupMember(u._id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected ? 'bg-orange-100/80 border border-[#FED7AA]' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar src={u.avatar} alt={u.name} size="xs" />
                        <span className="text-xs font-medium text-[#1F2937]">{u.name}</span>
                        <span className="text-[10px] text-[#6B7280]">@{u.username}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-[#F97316] rounded border-[#FED7AA]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
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
