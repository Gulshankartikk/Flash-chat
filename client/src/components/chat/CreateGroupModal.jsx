import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { useChatStore } from '../../store/useChatStore';
import { useDebounce } from '../../hooks/useDebounce';
import { Users, Check, Search, AlertCircle } from 'lucide-react';

export const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { searchResults, searchUsers, isSearching, createGroup } = useChatStore();

  useEffect(() => {
    if (debouncedSearch) {
      searchUsers(debouncedSearch);
    }
  }, [debouncedSearch, searchUsers]);

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Please provide a group name.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Please select at least 1 member for the group.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await createGroup({
        name: groupName.trim(),
        memberIds: selectedUserIds
      });
      setGroupName('');
      setSelectedUserIds([]);
      setSearchQuery('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Group Chat" maxWidth="max-w-md">
      <form onSubmit={handleCreate} className="space-y-4 pt-1">
        {error && (
          <div className="p-3 text-xs font-semibold text-accent bg-accent/10 border border-accent/20 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-ink mb-1.5">
            Group Name *
          </label>
          <input
            type="text"
            placeholder="e.g. Design Team, Project Alpha"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-line bg-cream/40 text-ink text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-ink mb-1.5">
            Add Members ({selectedUserIds.length} selected)
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-primary" />
            <input
              type="text"
              placeholder="Search by name or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-cream/40 text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-line/40 border border-line rounded-xl p-1 bg-cream/20">
            {isSearching ? (
              <p className="text-xs text-center py-4 text-muted">Searching users...</p>
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map((u) => {
                const isSelected = selectedUserIds.includes(u._id);
                return (
                  <div
                    key={u._id}
                    onClick={() => toggleUser(u._id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      isSelected
                        ? 'bg-primary/15 border border-line'
                        : 'hover:bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <div>
                        <p className="text-xs font-bold text-ink">{u.name}</p>
                        <p className="text-[10px] text-muted">@{u.username || u.phone}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-primary border-primary text-white'
                          : 'border-line bg-card'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            ) : searchQuery.trim() ? (
              <p className="text-xs text-center py-4 text-muted">No users found.</p>
            ) : (
              <p className="text-xs text-center py-4 text-muted">Type to search for contacts.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!groupName.trim() || selectedUserIds.length === 0}
            className="flex-1"
          >
            Create Group
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateGroupModal;
