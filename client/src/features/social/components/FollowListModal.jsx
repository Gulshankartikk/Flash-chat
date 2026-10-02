import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, UserCheck, UserPlus } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { SocialAvatar } from './SocialAvatar';
import {
  fetchUserFollowersApi,
  fetchUserFollowingApi,
  followUserApi,
  unfollowUserApi
} from '../api/api';
import { useAuthStore } from '../../../store/useAuthStore';

export const FollowListModal = ({ isOpen, onClose, userId, type = 'followers' }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingMap, setFollowingMap] = useState({}); // { [id]: boolean }

  const loadList = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res =
        type === 'followers'
          ? await fetchUserFollowersApi(userId)
          : await fetchUserFollowingApi(userId);

      if (res.success) {
        const list = res.data || [];
        setUsers(list);
        // Initialize followingMap
        const map = {};
        list.forEach((u) => {
          if (u.isFollowing !== undefined) {
            map[u._id] = Boolean(u.isFollowing);
          }
        });
        setFollowingMap(map);
      }
    } catch (err) {
      console.error(`Failed to load ${type}:`, err);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    if (isOpen && userId) {
      setSearchQuery('');
      loadList();
    }
  }, [isOpen, userId, loadList]);

  // Toggle follow
  const handleToggleFollow = async (targetId) => {
    const isCurrentlyFollowing = Boolean(followingMap[targetId]);
    setFollowingMap((prev) => ({ ...prev, [targetId]: !isCurrentlyFollowing }));

    try {
      if (isCurrentlyFollowing) {
        await unfollowUserApi(targetId);
      } else {
        await followUserApi(targetId);
      }
    } catch (err) {
      // Rollback
      setFollowingMap((prev) => ({ ...prev, [targetId]: isCurrentlyFollowing }));
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'followers' ? 'Followers' : 'Following'}
      size="sm"
    >
      <div className="flex flex-col max-h-[60vh]">
        {/* Search */}
        <div className="p-3 border-b border-[#FED7AA]/50">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA]">
            <Search className="w-3.5 h-3.5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs text-[#1F2937] bg-transparent focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#6B7280] hover:text-[#1F2937]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-[#FED7AA]/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-24 h-2.5 rounded-full bg-[#FED7AA]/40" />
                    <div className="w-16 h-2 rounded-full bg-[#FED7AA]/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-[#6B7280] text-center py-8">
              {searchQuery ? 'No matching users found.' : `No ${type} yet.`}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const isMe = String(user._id) === String(currentUser?._id);
              const isFollowing = Boolean(followingMap[user._id]);

              return (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-orange-50/70 transition"
                >
                  <div
                    onClick={() => {
                      onClose();
                      navigate(`/u/${user.username}`);
                    }}
                    className="flex items-center gap-3 cursor-pointer flex-1"
                  >
                    <SocialAvatar src={user.avatar} alt={user.username} size="sm" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-[#1F2937] hover:underline">
                          {user.username}
                        </span>
                        {user.isVerified && (
                          <span className="w-3 h-3 rounded-full bg-[#F97316] text-white text-[8px] flex items-center justify-center font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#6B7280]">{user.name}</span>
                    </div>
                  </div>

                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(user._id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        isFollowing
                          ? 'bg-[#FFF7ED] border border-[#FED7AA] text-[#1F2937] hover:border-rose-300 hover:text-rose-600'
                          : 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-xs'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
