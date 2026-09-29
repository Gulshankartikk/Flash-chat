import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { useChatStore } from '../../store/useChatStore';
import { useDebounce } from '../../hooks/useDebounce';
import { Users, Check, Search } from 'lucide-react';

export const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { searchResults, searchUsers, isSearching, createGroupChat } = useChatStore();

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
      await createGroupChat({
        name: groupName.trim(),
        participantIds: selectedUserIds
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Group Chat">
      <form onSubmit={handleCreate} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Group Name
          </label>
          <input
            type="text"
            placeholder="e.g. Design Team, Project Alpha"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Add Members ({selectedUserIds.length} selected)
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50/50 dark:bg-slate-950/40">
            {isSearching ? (
              <p className="text-xs text-center py-4 text-slate-400">Searching users...</p>
            ) : searchResults.length > 0 ? (
              searchResults.map((u) => {
                const isSelected = selectedUserIds.includes(u._id);
                return (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => toggleUser(u._id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={u.avatar} name={u.name} size="sm" isOnline={u.isOnline} />
                      <div>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {u.name}
                        </p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-center py-4 text-slate-400">
                {searchQuery ? 'No users found.' : 'Search above to find members'}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-indigo-500/20 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
