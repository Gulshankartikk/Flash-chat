import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, ExternalLink, Sparkles } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Avatar } from '../../components/Avatar';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export const UserSearchModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setIsLoading(false);
      return;
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
        setResults(res.data.users || []);
      } catch (err) {
        console.error('User search failed:', err.message);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectUser = (username) => {
    onClose();
    if (currentUser?.username === username) {
      navigate('/profile');
    } else {
      navigate(`/u/${username}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Flash Chat Users" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Search input field */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-[#F97316] pointer-events-none" />
          <input
            type="text"
            autoFocus
            placeholder="Search by name or @username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] placeholder-[#6B7280]/60 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:bg-white transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 p-1 rounded-full text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results Area */}
        <div className="min-h-[220px] max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
          {isLoading ? (
            <div className="space-y-3 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
                  <Skeleton variant="avatar" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="w-28 h-3.5" />
                    <Skeleton className="w-20 h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            results.map((user) => (
              <div
                key={user._id}
                onClick={() => handleSelectUser(user.username)}
                className="flex items-center justify-between p-3 rounded-2xl border border-transparent hover:border-[#FED7AA] hover:bg-[#FFF7ED]/70 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={user.avatar}
                    alt={user.name}
                    size="md"
                    isOnline={user.isOnline}
                    showStatus
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-[#1F2937] truncate group-hover:text-[#F97316] transition">
                        {user.name}
                      </p>
                      {user.isPrivateAccount && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-[#F97316] font-semibold">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280] truncate">
                      @{user.username}
                    </p>
                    {user.bio && (
                      <p className="text-[11px] text-[#6B7280]/80 truncate mt-0.5">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-2 rounded-xl text-[#6B7280] group-hover:text-[#F97316] group-hover:bg-white transition flex-shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            ))
          ) : query.trim() ? (
            <EmptyState
              emoji="🔍"
              title="No users found"
              description={`We couldn't find anyone matching "${query}". Try searching a different handle or full name.`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[#6B7280]">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-[#FED7AA] flex items-center justify-center text-[#F97316] mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="font-semibold text-[#1F2937] text-sm">
                Discover People on Flash Chat
              </p>
              <p className="mt-1 max-w-xs text-[11px]">
                Search across the unified contact graph to message, follow on Social, or share Pocket vaults.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default UserSearchModal;
