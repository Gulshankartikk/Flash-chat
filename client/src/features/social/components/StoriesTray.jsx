import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { fetchStoriesTray } from '../api/api';
import { useSocialStore } from '../store/useSocialStore';
import { SocialAvatar } from './SocialAvatar';

export const StoriesTray = () => {
  const { user: currentUser } = useAuthStore();
  const { openStoryViewer, openCreateModal } = useSocialStore();
  const [trayUsers, setTrayUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTray = async () => {
    try {
      const res = await fetchStoriesTray();
      if (res.success) {
        setTrayUsers(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load stories tray:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTray();
    // Refresh tray every 3 minutes or on focus
    const interval = setInterval(loadTray, 180000);
    return () => clearInterval(interval);
  }, []);

  const myStoryCluster = trayUsers.find((item) => item.isMe);
  const otherStoryClusters = trayUsers.filter((item) => !item.isMe);

  const handleOpenMyStory = () => {
    if (myStoryCluster && myStoryCluster.stories?.length > 0) {
      const myIndex = trayUsers.findIndex((item) => item.isMe);
      openStoryViewer(trayUsers, myIndex >= 0 ? myIndex : 0, 0);
    } else {
      openCreateModal('story');
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-[#FED7AA]/60 p-3 shadow-xs">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1">
        {/* "Your Story" item */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
          <div className="relative">
            <SocialAvatar
              src={currentUser?.avatar}
              alt={currentUser?.name || 'You'}
              size="md"
              hasStory={Boolean(myStoryCluster && myStoryCluster.stories?.length > 0)}
              hasUnseen={Boolean(myStoryCluster?.hasUnseen)}
              onClick={handleOpenMyStory}
            />
            {/* Plus badge if no stories or to add another */}
            {(!myStoryCluster || myStoryCluster.stories?.length === 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openCreateModal('story');
                }}
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white flex items-center justify-center ring-2 ring-white shadow-xs group-hover:scale-110 transition cursor-pointer"
                title="Add Story"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            )}
          </div>
          <span className="text-[11px] font-medium text-[#1F2937] max-w-[64px] truncate text-center">
            Your story
          </span>
        </div>

        {/* Other Following Users Stories */}
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[#FED7AA]/40" />
                <div className="w-10 h-2 rounded-full bg-[#FED7AA]/40" />
              </div>
            ))
          : otherStoryClusters.map((cluster) => {
              const userIndex = trayUsers.findIndex(
                (item) => String(item.user?._id) === String(cluster.user?._id)
              );
              return (
                <div
                  key={cluster.user?._id}
                  onClick={() => openStoryViewer(trayUsers, userIndex, 0)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                >
                  <SocialAvatar
                    src={cluster.user?.avatar}
                    alt={cluster.user?.name || cluster.user?.username}
                    size="md"
                    hasStory={true}
                    hasUnseen={cluster.hasUnseen}
                  />
                  <span className="text-[11px] font-medium text-[#1F2937] max-w-[64px] truncate text-center">
                    {cluster.user?.username || cluster.user?.name}
                  </span>
                </div>
              );
            })}
      </div>
    </div>
  );
};
