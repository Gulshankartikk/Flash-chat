import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  UserPlus,
  UserCheck,
  Clock,
  Lock,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Phone,
  Video,
  MoreVertical,
  Flag,
  UserX,
  Link2,
  Share2,
  Grid,
  Film,
  Bookmark,
  Play,
  Layers,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCall } from '../features/calls';
import { useSocialStore } from '../features/social/store/useSocialStore';
import {
  fetchUserProfileApi,
  fetchUserPostsApi,
  fetchUserReelsApi,
  followUserApi,
  unfollowUserApi,
  blockUserApi,
  unblockUserApi,
  createDirectChatApi,
  fetchStoriesTray
} from '../features/social/api/api';
import { SocialAvatar } from '../features/social/components/SocialAvatar';
import { FollowListModal } from '../features/social/components/FollowListModal';
import { FollowRequestsModal } from '../features/social/components/FollowRequestsModal';
import { PostViewerModal } from '../features/social/components/PostViewerModal';

export const PublicProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { startCall, callState } = useCall();
  const { openShareSheet, openStoryViewer } = useSocialStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Follow & block state
  const [followStatus, setFollowStatus] = useState('none'); // 'none' | 'pending' | 'accepted'
  const [followersCount, setFollowersCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // Content grids state
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'reels' | 'saved'
  const [userPosts, setUserPosts] = useState([]);
  const [userReels, setUserReels] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isPrivateLocked, setIsPrivateLocked] = useState(false);

  // Modals
  const [activeFollowModal, setActiveFollowModal] = useState(null); // 'followers' | 'following' | null
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [activePostId, setActivePostId] = useState(null);

  const isMe =
    Boolean(currentUser?._id && profile?._id) &&
    (String(currentUser._id) === String(profile._id) || currentUser.username === username);

  // Load Profile
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserProfileApi(username);
      if (res.success && res.user) {
        const u = res.user;
        setProfile(u);
        setFollowStatus(u.followStatus || 'none');
        setFollowersCount(u.followersCount || 0);
        setIsBlocked(Boolean(u.isBlockedByMe));
      } else {
        setError('User not found.');
      }
    } catch (err) {
      setError(
        err.response?.status === 404
          ? 'User not found or you have been blocked.'
          : 'Failed to load profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Load Content (Posts / Reels) once profile is loaded
  useEffect(() => {
    if (!profile?._id) return;

    const loadPostsAndReels = async () => {
      setLoadingContent(true);
      try {
        if (activeTab === 'posts') {
          const res = await fetchUserPostsApi(profile._id);
          if (res.success) {
            setIsPrivateLocked(Boolean(res.isPrivate));
            setUserPosts(res.data || []);
          }
        } else if (activeTab === 'reels') {
          const res = await fetchUserReelsApi(profile._id);
          if (res.success) {
            setIsPrivateLocked(Boolean(res.isPrivate));
            setUserReels(res.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to load user content:', err);
      } finally {
        setLoadingContent(false);
      }
    };

    loadPostsAndReels();
  }, [profile?._id, activeTab, followStatus]);

  // Tap avatar to open story
  const handleAvatarClick = async () => {
    if (!profile?.hasActiveStory) return;
    try {
      const res = await fetchStoriesTray();
      if (res.success && res.data) {
        const index = res.data.findIndex((c) => String(c.user?._id) === String(profile._id));
        if (index >= 0) {
          openStoryViewer(res.data, index, 0);
        }
      }
    } catch (err) {
      console.error('Failed to open user story:', err);
    }
  };

  // Follow / Unfollow Toggle
  const handleToggleFollow = async () => {
    const prevStatus = followStatus;
    const prevCount = followersCount;

    if (prevStatus === 'accepted') {
      setFollowStatus('none');
      setFollowersCount(Math.max(prevCount - 1, 0));
      try {
        await unfollowUserApi(profile._id);
      } catch (err) {
        setFollowStatus(prevStatus);
        setFollowersCount(prevCount);
      }
    } else if (prevStatus === 'pending') {
      setFollowStatus('none');
      try {
        await unfollowUserApi(profile._id);
      } catch (err) {
        setFollowStatus(prevStatus);
      }
    } else {
      // Follow
      if (profile.isPrivateAccount) {
        setFollowStatus('pending');
      } else {
        setFollowStatus('accepted');
        setFollowersCount(prevCount + 1);
      }

      try {
        const res = await followUserApi(profile._id);
        if (res.success && res.data) {
          setFollowStatus(res.data.status || 'accepted');
        }
      } catch (err) {
        setFollowStatus(prevStatus);
        setFollowersCount(prevCount);
      }
    }
  };

  // Start Direct Chat (deep link /chats/:conversationId)
  const handleStartChat = async () => {
    try {
      const res = await createDirectChatApi(profile._id);
      const convId = res.conversation?._id || res.data?._id;
      if (convId) {
        navigate(`/chats/${convId}`);
      } else {
        navigate('/chats');
      }
    } catch (err) {
      console.error('Failed to initiate direct chat:', err);
      navigate('/chats');
    }
  };

  // WebRTC Audio / Video Calls
  const handleStartCall = async (type = 'audio') => {
    if (!profile?._id || callState !== 'idle') return;
    try {
      const res = await createDirectChatApi(profile._id);
      const convId = res.conversation?._id || res.data?._id;
      if (convId) {
        startCall({
          conversationId: convId,
          type
        });
      }
    } catch (err) {
      console.error('Failed to start call from profile:', err);
    }
  };

  // Block / Unblock
  const handleToggleBlock = async () => {
    try {
      if (isBlocked) {
        await unblockUserApi(profile._id);
        setIsBlocked(false);
        alert(`Unblocked @${profile.username}`);
      } else {
        if (!window.confirm(`Block @${profile.username}? They will no longer be able to message you or view your profile.`)) return;
        await blockUserApi(profile._id);
        setIsBlocked(true);
        alert(`Blocked @${profile.username}`);
      }
    } catch (err) {
      console.error('Block toggle failed:', err);
    } finally {
      setShowOptionsMenu(false);
    }
  };

  // Copy Profile Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Profile link copied to clipboard!');
    setShowOptionsMenu(false);
  };

  // Share Profile
  const handleShareProfile = () => {
    setShowOptionsMenu(false);
    const snapshot = {
      thumbnail: profile.avatar || '',
      authorUsername: profile.username,
      authorName: profile.name,
      authorAvatar: profile.avatar,
      captionSnippet: profile.bio || 'Check out this profile on Flash Chat!',
      mediaType: 'profile'
    };
    openShareSheet('profile', profile._id, snapshot);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] animate-pulse space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-[#FED7AA]/40" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 rounded-full bg-[#FED7AA]/40" />
              <div className="w-24 h-3 rounded-full bg-[#FED7AA]/30" />
            </div>
          </div>
          <div className="w-full h-10 rounded-2xl bg-[#FED7AA]/20" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-[#F43F5E] flex items-center justify-center mx-auto text-2xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#1F2937]">User Not Found</h2>
        <p className="text-xs text-[#6B7280]">
          The account @{username} doesn't exist, has been deleted, or you have been blocked.
        </p>
        <button
          type="button"
          onClick={() => navigate('/social')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-xs hover:opacity-95 cursor-pointer"
        >
          Explore Social
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20 p-2 sm:p-0">
      {/* Top Bar with Back and Options */}
      <div className="flex items-center justify-between px-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-full hover:bg-orange-100 text-[#1F2937] transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-bold text-[#1F2937]">@{profile.username}</span>

        {/* Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1.5 rounded-full hover:bg-orange-100 text-[#1F2937] transition cursor-pointer"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOptionsMenu && (
            <div className="absolute right-0 top-8 z-40 w-44 bg-white rounded-2xl border border-[#FED7AA] shadow-xl p-1.5 text-xs font-semibold text-[#1F2937] space-y-0.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50 flex items-center gap-2 cursor-pointer text-left"
              >
                <Link2 className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Copy Profile Link</span>
              </button>
              <button
                type="button"
                onClick={handleShareProfile}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50 flex items-center gap-2 cursor-pointer text-left"
              >
                <Share2 className="w-3.5 h-3.5 text-[#EC4899]" />
                <span>Share Profile</span>
              </button>

              {!isMe && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      alert('Profile reported for review.');
                      setShowOptionsMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer text-left"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report User</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer text-left"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-5 sm:p-6 border border-[#FED7AA]/60 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-5 sm:gap-6">
          {/* Avatar with Story ring */}
          <div className="relative">
            <SocialAvatar
              src={profile.avatar}
              alt={profile.name}
              size="xl"
              hasStory={Boolean(profile.hasActiveStory)}
              hasUnseen={Boolean(profile.hasActiveStory)}
              onClick={handleAvatarClick}
            />
          </div>

          {/* Counts Row */}
          <div className="flex-1 flex items-center justify-around text-center text-xs">
            <div>
              <p className="text-base font-black text-[#1F2937]">{profile.postsCount || 0}</p>
              <p className="text-[#6B7280]">posts</p>
            </div>
            <div
              onClick={() => setActiveFollowModal('followers')}
              className="cursor-pointer hover:opacity-80"
            >
              <p className="text-base font-black text-[#1F2937]">{followersCount}</p>
              <p className="text-[#6B7280]">followers</p>
            </div>
            <div
              onClick={() => setActiveFollowModal('following')}
              className="cursor-pointer hover:opacity-80"
            >
              <p className="text-base font-black text-[#1F2937]">{profile.followingCount || 0}</p>
              <p className="text-[#6B7280]">following</p>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-[#1F2937]">{profile.name}</h2>
            {profile.isVerified && (
              <span className="w-3.5 h-3.5 rounded-full bg-[#F97316] text-white text-[9px] flex items-center justify-center font-bold">
                ✓
              </span>
            )}
            {profile.isPrivateAccount && (
              <span className="px-1.5 py-0.2 rounded-full bg-orange-100 text-[#F97316] text-[10px] font-bold">
                Private
              </span>
            )}
          </div>
          <p className="text-xs text-[#1F2937] whitespace-pre-line leading-relaxed">
            {profile.bio || '⚡ Hey there! I am using Flash Chat.'}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280] pt-0.5">
            <Calendar className="w-3 h-3 text-[#F97316]" />
            <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 pt-1">
          {isMe ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex-1 py-2 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-xs font-bold text-[#1F2937] hover:border-[#F97316] transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Edit Profile</span>
              </button>
              {profile.isPrivateAccount && (
                <button
                  type="button"
                  onClick={() => setShowRequestsModal(true)}
                  className="px-3 py-2 rounded-xl bg-orange-100 text-[#F97316] text-xs font-bold hover:bg-orange-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Requests</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Follow Button */}
              {isBlocked ? (
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  className="flex-1 py-2 rounded-xl bg-rose-100 text-rose-600 text-xs font-bold cursor-pointer"
                >
                  Unblock
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    followStatus === 'accepted'
                      ? 'bg-[#FFF7ED] border border-[#FED7AA] text-[#1F2937] hover:bg-orange-50'
                      : followStatus === 'pending'
                      ? 'bg-neutral-100 text-[#6B7280] border border-neutral-300'
                      : 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-orange-500/15'
                  }`}
                >
                  {followStatus === 'accepted' ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Following</span>
                    </>
                  ) : followStatus === 'pending' ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Requested</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}

              {/* Message Button -> Deep links to /chats/:conversationId */}
              <button
                type="button"
                onClick={handleStartChat}
                className="flex-1 py-2 rounded-xl bg-white border border-[#FED7AA] text-xs font-bold text-[#1F2937] hover:border-[#F97316] transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Message</span>
              </button>

              {/* Audio Call */}
              <button
                type="button"
                disabled={callState !== 'idle'}
                onClick={() => handleStartCall('audio')}
                className="p-2 rounded-xl bg-white border border-[#FED7AA] text-[#1F2937] hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50 transition cursor-pointer"
                title="Voice Call"
              >
                <Phone className="w-4 h-4" />
              </button>

              {/* Video Call */}
              <button
                type="button"
                disabled={callState !== 'idle'}
                onClick={() => handleStartCall('video')}
                className="p-2 rounded-xl bg-white border border-[#FED7AA] text-[#1F2937] hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50 transition cursor-pointer"
                title="Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Tabs Row: Posts | Reels | Saved (own only) */}
      <div className="flex items-center justify-around bg-white rounded-2xl border border-[#FED7AA]/60 p-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'posts'
              ? 'bg-[#FFF7ED] text-[#F97316] shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Posts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'reels'
              ? 'bg-[#FFF7ED] text-[#F97316] shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Reels</span>
        </button>

        {isMe && (
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-[#FFF7ED] text-[#F97316] shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved</span>
          </button>
        )}
      </div>

      {/* Content Display Grid or Private Lock Screen */}
      {isPrivateLocked ? (
        <div className="bg-white rounded-3xl p-8 border border-[#FED7AA]/60 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-sm font-bold text-[#1F2937]">This Account is Private</h3>
          <p className="text-xs text-[#6B7280] max-w-xs mx-auto">
            Follow this account to see their photos, reels, and shared moments.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-2 sm:p-3 border border-[#FED7AA]/60 shadow-xs min-h-[220px]">
          {loadingContent ? (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl bg-[#FED7AA]/30 animate-pulse"
                />
              ))}
            </div>
          ) : activeTab === 'posts' ? (
            userPosts.length === 0 ? (
              <p className="text-xs text-[#6B7280] text-center py-12">No posts yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {userPosts.map((post) => (
                  <div
                    key={post._id}
                    onClick={() => setActivePostId(post._id)}
                    className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 cursor-pointer group shadow-xs"
                  >
                    <img
                      src={post.media?.[0]?.thumbnail || post.media?.[0]?.url}
                      alt="Post"
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {post.media?.length > 1 && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white">
                        <Layers className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'reels' ? (
            userReels.length === 0 ? (
              <p className="text-xs text-[#6B7280] text-center py-12">No reels yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {userReels.map((reel) => (
                  <div
                    key={reel._id}
                    onClick={() => navigate('/social/reels')}
                    className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900 cursor-pointer group shadow-xs"
                  >
                    <img
                      src={reel.media?.thumbnail || reel.media?.url}
                      alt="Reel"
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-xs text-[#6B7280] text-center py-12">
              Saved posts are private to you.
            </p>
          )}
        </div>
      )}

      {/* Followers / Following List Modal */}
      {activeFollowModal && (
        <FollowListModal
          isOpen={Boolean(activeFollowModal)}
          onClose={() => setActiveFollowModal(null)}
          userId={profile._id}
          type={activeFollowModal}
        />
      )}

      {/* Follow Requests Modal (Own profile) */}
      {showRequestsModal && (
        <FollowRequestsModal
          isOpen={showRequestsModal}
          onClose={() => setShowRequestsModal(false)}
        />
      )}

      {/* Post Viewer Modal */}
      <PostViewerModal
        postId={activePostId}
        isOpen={Boolean(activePostId)}
        onClose={() => setActivePostId(null)}
      />
    </div>
  );
};

export default PublicProfilePage;
