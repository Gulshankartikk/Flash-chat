import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  UserPlus,
  UserCheck,
  X,
  Heart,
  MessageCircle,
  Share2,
  Film,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSocialStore } from '../store/useSocialStore';
import { getSocket } from '../../../services/socket';
import {
  fetchNotifications,
  markNotificationsReadApi,
  followUserApi,
  acceptFollowRequestApi,
  rejectFollowRequestApi
} from '../api/api';
import { SocialAvatar } from '../components/SocialAvatar';
import { RelativeTime } from '../components/RelativeTime';

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { clearUnreadNotifications, incrementUnreadNotifications } = useSocialStore();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [followingMap, setFollowingMap] = useState({});

  // Real-time toast
  const [realtimeToast, setRealtimeToast] = useState(null);

  // Load notifications
  const loadNotifications = useCallback(async (cursor = null) => {
    try {
      if (!cursor) setLoading(true);
      const res = await fetchNotifications({ cursor, limit: 25 });
      if (res.success) {
        const items = res.data || [];
        setNotifications((prev) => (cursor ? [...prev, ...items] : items));
        setNextCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Socket listener for real-time notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotif = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      incrementUnreadNotifications();

      // Show real-time notification popup
      setRealtimeToast(notif);
      setTimeout(() => setRealtimeToast(null), 4000);
    };

    socket.on('notification:new', handleNewNotif);

    return () => {
      socket.off('notification:new', handleNewNotif);
    };
  }, [incrementUnreadNotifications]);

  // Mark all read
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    clearUnreadNotifications();
    try {
      await markNotificationsReadApi();
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  // Follow back action
  const handleFollowBack = async (actorId) => {
    setFollowingMap((prev) => ({ ...prev, [actorId]: true }));
    try {
      await followUserApi(actorId);
    } catch (err) {
      setFollowingMap((prev) => ({ ...prev, [actorId]: false }));
    }
  };

  // Accept follow request
  const handleAcceptRequest = async (notifId, reqId) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === notifId ? { ...n, type: 'follow_accepted', text: 'You accepted their follow request' } : n))
    );
    try {
      await acceptFollowRequestApi(reqId);
    } catch (err) {
      console.error('Accept request error:', err);
    }
  };

  // Reject follow request
  const handleRejectRequest = async (notifId, reqId) => {
    setNotifications((prev) => prev.filter((n) => n._id !== notifId));
    try {
      await rejectFollowRequestApi(reqId);
    } catch (err) {
      console.error('Reject request error:', err);
    }
  };

  // Tap notification row
  const handleRowClick = (notif) => {
    if (notif.type === 'follow' || notif.type === 'follow_accepted') {
      navigate(`/u/${notif.actor?.username}`);
    } else if (notif.type === 'like' || notif.type === 'comment' || notif.type === 'reply') {
      if (notif.target?.kind === 'post') {
        navigate(`/social/post/${notif.target.refId}`);
      } else if (notif.target?.kind === 'reel') {
        navigate('/social/reels');
      }
    } else if (notif.type === 'story_reply' || notif.type === 'share') {
      navigate('/chats');
    } else if (notif.actor?.username) {
      navigate(`/u/${notif.actor.username}`);
    }
  };

  // Group notifications by time
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;

  const todayList = [];
  const thisWeekList = [];
  const earlierList = [];

  notifications.forEach((n) => {
    const diff = now - new Date(n.createdAt).getTime();
    if (diff < ONE_DAY) todayList.push(n);
    else if (diff < ONE_WEEK) thisWeekList.push(n);
    else earlierList.push(n);
  });

  const renderGroup = (title, items) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#6B7280] px-2">{title}</h4>
        <div className="space-y-1.5">
          {items.map((notif) => {
            const isFollowingBack = Boolean(followingMap[notif.actor?._id]);

            return (
              <div
                key={notif._id}
                onClick={() => handleRowClick(notif)}
                className={`flex items-center justify-between p-3 rounded-2xl transition cursor-pointer ${
                  notif.read ? 'bg-white hover:bg-orange-50/50' : 'bg-orange-50/80 hover:bg-orange-100/60'
                } border border-[#FED7AA]/50 shadow-xs`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <SocialAvatar
                      src={notif.actor?.avatar}
                      alt={notif.actor?.username}
                      size="sm"
                    />
                    {!notif.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#F43F5E] ring-2 ring-white" />
                    )}
                  </div>

                  <div className="text-xs leading-relaxed flex-1 min-w-0 pr-2">
                    <p className="text-[#1F2937] truncate">
                      <span className="font-bold mr-1">{notif.actor?.username || 'Someone'}</span>
                      <span className="text-[#6B7280]">{notif.message || notif.text}</span>
                    </p>
                    <RelativeTime date={notif.createdAt} className="text-[10px] text-[#6B7280]" />
                  </div>
                </div>

                {/* Right Action / Thumbnail */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Inline Follow back */}
                  {notif.type === 'follow' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowBack(notif.actor?._id);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        isFollowingBack
                          ? 'bg-[#FFF7ED] border border-[#FED7AA] text-[#1F2937]'
                          : 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-xs'
                      }`}
                    >
                      {isFollowingBack ? 'Following' : 'Follow back'}
                    </button>
                  )}

                  {/* Inline Follow Request Confirm/Reject */}
                  {notif.type === 'follow_request' && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptRequest(notif._id, notif.target?.refId || notif._id);
                        }}
                        className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-[11px] font-bold shadow-xs hover:opacity-95 cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRejectRequest(notif._id, notif.target?.refId || notif._id);
                        }}
                        className="p-1 rounded-full text-[#6B7280] hover:text-[#F43F5E] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Post / Reel thumbnail preview on right */}
                  {notif.targetThumbnail && (
                    <img
                      src={notif.targetThumbnail}
                      alt="Thumbnail"
                      className="w-10 h-10 rounded-xl object-cover border border-[#FED7AA]"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20">
      {/* Real-time Notification Banner / Toast */}
      {realtimeToast && (
        <div className="fixed top-16 inset-x-4 max-w-md mx-auto z-50 p-3 rounded-2xl bg-white border border-[#FED7AA] shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <SocialAvatar
            src={realtimeToast.actor?.avatar}
            alt={realtimeToast.actor?.username}
            size="sm"
          />
          <div className="flex-1 text-xs">
            <span className="font-bold text-[#1F2937]">@{realtimeToast.actor?.username} </span>
            <span className="text-[#6B7280]">{realtimeToast.message || realtimeToast.text}</span>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#F97316]" />
          <h2 className="text-sm font-bold text-[#1F2937]">Activity</h2>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs font-semibold text-[#F97316] hover:underline cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#FED7AA]/60 p-3 flex items-center gap-3 animate-pulse"
            >
              <div className="w-10 h-10 rounded-full bg-[#FED7AA]/40" />
              <div className="flex-1 space-y-1.5">
                <div className="w-48 h-2.5 rounded-full bg-[#FED7AA]/40" />
                <div className="w-24 h-2 rounded-full bg-[#FED7AA]/30" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#FED7AA]/60 p-12 text-center space-y-2 shadow-xs">
          <Bell className="w-12 h-12 text-[#FED7AA] mx-auto stroke-1" />
          <h3 className="text-sm font-bold text-[#1F2937]">No notifications yet</h3>
          <p className="text-xs text-[#6B7280]">
            When people like your posts, comment, follow you, or share content, you'll see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderGroup('Today', todayList)}
          {renderGroup('This Week', thisWeekList)}
          {renderGroup('Earlier', earlierList)}
        </div>
      )}
    </div>
  );
};
