import api from '../../../services/api';

/**
 * Social Feature API client
 */

// -------------------------------------------------------------
// POSTS API
// -------------------------------------------------------------
export const fetchFeedPosts = async ({ cursor, limit = 10 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/posts/feed?${params.toString()}`);
  return res.data;
};

export const fetchPostById = async (postId) => {
  const res = await api.get(`/posts/${postId}`);
  return res.data;
};

export const createPostApi = async (postData, onProgress, cancelToken) => {
  const res = await api.post('/posts', postData, {
    onUploadProgress: onProgress,
    signal: cancelToken
  });
  return res.data;
};

export const deletePostApi = async (postId) => {
  const res = await api.delete(`/posts/${postId}`);
  return res.data;
};

export const toggleLikePostApi = async (postId) => {
  const res = await api.post(`/posts/${postId}/like`);
  return res.data;
};

export const toggleSavePostApi = async (postId) => {
  const res = await api.post(`/posts/${postId}/save`);
  return res.data;
};

// -------------------------------------------------------------
// REELS API
// -------------------------------------------------------------
export const fetchReelsFeed = async ({ cursor, limit = 10 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/reels/feed?${params.toString()}`);
  return res.data;
};

export const fetchReelById = async (reelId) => {
  const res = await api.get(`/reels/${reelId}`);
  return res.data;
};

export const createReelApi = async (reelData, onProgress, cancelToken) => {
  const res = await api.post('/reels', reelData, {
    onUploadProgress: onProgress,
    signal: cancelToken
  });
  return res.data;
};

export const toggleLikeReelApi = async (reelId) => {
  const res = await api.post(`/reels/${reelId}/like`);
  return res.data;
};

export const toggleSaveReelApi = async (reelId) => {
  const res = await api.post(`/reels/${reelId}/save`);
  return res.data;
};

export const recordReelViewApi = async (reelId) => {
  const res = await api.post(`/reels/${reelId}/view`);
  return res.data;
};

// -------------------------------------------------------------
// STORIES API
// -------------------------------------------------------------
export const fetchStoriesTray = async () => {
  const res = await api.get('/stories/tray');
  return res.data;
};

export const createStoryApi = async (storyData, onProgress, cancelToken) => {
  const res = await api.post('/stories', storyData, {
    onUploadProgress: onProgress,
    signal: cancelToken
  });
  return res.data;
};

export const markStoryViewedApi = async (storyId) => {
  const res = await api.post(`/stories/${storyId}/view`);
  return res.data;
};

export const replyToStoryApi = async (storyId, text) => {
  const res = await api.post(`/stories/${storyId}/reply`, { text });
  return res.data;
};

export const deleteStoryApi = async (storyId) => {
  const res = await api.delete(`/stories/${storyId}`);
  return res.data;
};

// -------------------------------------------------------------
// COMMENTS API
// -------------------------------------------------------------
export const fetchComments = async ({ targetType = 'post', targetId, cursor, limit = 20 }) => {
  const endpoint = targetType === 'reel' ? `/reels/${targetId}/comments` : `/posts/${targetId}/comments`;
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`${endpoint}?${params.toString()}`);
  return res.data;
};

export const createCommentApi = async ({ targetType = 'post', targetId, text, parentId }) => {
  const endpoint = targetType === 'reel' ? `/reels/${targetId}/comments` : `/posts/${targetId}/comments`;
  const res = await api.post(endpoint, { text, parent: parentId || null });
  return res.data;
};

export const fetchCommentReplies = async (commentId) => {
  const res = await api.get(`/comments/${commentId}/replies`);
  return res.data;
};

export const deleteCommentApi = async (commentId) => {
  const res = await api.delete(`/comments/${commentId}`);
  return res.data;
};

export const toggleLikeCommentApi = async (commentId, currentIsLiked) => {
  if (currentIsLiked) {
    const res = await api.delete(`/comments/${commentId}/like`);
    return res.data;
  }
  const res = await api.post(`/comments/${commentId}/like`);
  return res.data;
};

// -------------------------------------------------------------
// SHARE API
// -------------------------------------------------------------
export const fetchShareSuggestions = async (query = '') => {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  const res = await api.get(`/share/suggestions${params}`);
  return res.data;
};

export const shareContentApi = async ({ kind, refId, conversationIds, text = '' }) => {
  const res = await api.post('/share', { kind, refId, conversationIds, text });
  return res.data;
};

// -------------------------------------------------------------
// EXPLORE, HASHTAGS & SEARCH API
// -------------------------------------------------------------
export const fetchExplore = async ({ cursor, limit = 18 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/explore?${params.toString()}`);
  return res.data;
};

export const fetchHashtagPosts = async (tag, { cursor, limit = 18 } = {}) => {
  const cleanTag = tag.replace(/^#/, '');
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/hashtags/${encodeURIComponent(cleanTag)}?${params.toString()}`);
  return res.data;
};

export const searchSocialApi = async ({ q, type = 'users' }) => {
  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (type) params.append('type', type);
  const res = await api.get(`/search?${params.toString()}`);
  return res.data;
};

export const searchUsersAndTagsApi = async (query) => {
  if (!query || !query.trim()) return { users: [], tags: [] };
  const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
  return res.data;
};

// -------------------------------------------------------------
// NOTIFICATIONS API
// -------------------------------------------------------------
export const fetchNotifications = async ({ cursor, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/notifications?${params.toString()}`);
  return res.data;
};

export const fetchUnreadNotificationsCount = async () => {
  const res = await api.get('/notifications/unread-count');
  return res.data;
};

export const markNotificationsReadApi = async () => {
  const res = await api.patch('/notifications/read-all');
  return res.data;
};

// -------------------------------------------------------------
// CLOUDINARY DIRECT UPLOADER
// -------------------------------------------------------------
export const uploadMediaFile = async (file, onProgress, cancelSignal) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
    signal: cancelSignal
  });
  return res.data;
};

// -------------------------------------------------------------
// USER PROFILE & SOCIAL GRAPH API
// -------------------------------------------------------------
export const fetchUserProfileApi = async (username) => {
  const res = await api.get(`/users/${encodeURIComponent(username)}`);
  return res.data;
};

export const fetchUserPostsApi = async (userId, { cursor, limit = 12 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/users/${userId}/posts?${params.toString()}`);
  return res.data;
};

export const fetchUserReelsApi = async (userId, { cursor, limit = 12 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/users/${userId}/reels?${params.toString()}`);
  return res.data;
};

export const fetchUserFollowersApi = async (userId, { cursor, limit = 30 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/users/${userId}/followers?${params.toString()}`);
  return res.data;
};

export const fetchUserFollowingApi = async (userId, { cursor, limit = 30 } = {}) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit);
  const res = await api.get(`/users/${userId}/following?${params.toString()}`);
  return res.data;
};

export const followUserApi = async (userId) => {
  const res = await api.post(`/follow/${userId}`);
  return res.data;
};

export const unfollowUserApi = async (userId) => {
  const res = await api.delete(`/follow/${userId}`);
  return res.data;
};

export const fetchPendingFollowRequestsApi = async () => {
  const res = await api.get('/follow/requests');
  return res.data;
};

export const acceptFollowRequestApi = async (requestId) => {
  const res = await api.post(`/follow/requests/${requestId}/accept`);
  return res.data;
};

export const rejectFollowRequestApi = async (requestId) => {
  const res = await api.post(`/follow/requests/${requestId}/reject`);
  return res.data;
};

export const blockUserApi = async (userId) => {
  const res = await api.post(`/users/${userId}/block`);
  return res.data;
};

export const unblockUserApi = async (userId) => {
  const res = await api.delete(`/users/${userId}/block`);
  return res.data;
};

export const createDirectChatApi = async (userId) => {
  const res = await api.post('/chats/direct', { userId });
  return res.data;
};

