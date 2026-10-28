import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Compass, PlusCircle } from 'lucide-react';
import { fetchFeedPosts } from '../api/api';
import { useSocialStore } from '../store/useSocialStore';
import { StoriesTray } from './StoriesTray';
import { PostCard } from './PostCard';

export const FeedView = () => {
  const navigate = useNavigate();
  const { openCreateModal } = useSocialStore();

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const observerRef = useRef(null);

  const loadFeed = async (cursor = null, isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else if (!cursor) setIsLoading(true);
      else setIsFetchingMore(true);

      const res = await fetchFeedPosts({ cursor, limit: 10 });
      if (res.success) {
        const newPosts = res.data || [];
        setPosts((prev) => (isRefresh || !cursor ? newPosts : [...prev, ...newPosts]));
        setNextCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // Infinite scroll intersection observer
  const lastPostRef = useCallback(
    (node) => {
      if (isLoading || isFetchingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && nextCursor) {
          loadFeed(nextCursor);
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingMore, hasMore, nextCursor]
  );

  const handlePostDeleted = (deletedPostId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20">
      {/* 1. Horizontal Stories Tray */}
      <StoriesTray />

      {/* 2. Pull / Manual Refresh button */}
      <div className="flex items-center justify-between px-2 pt-1">
        <span className="text-xs font-bold text-muted">Latest Updates</span>
        <button
          type="button"
          onClick={() => loadFeed(null, true)}
          disabled={isRefreshing}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-secondary transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* 3. Feed List */}
      {isLoading ? (
        // Skeleton placeholders
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-card rounded-3xl border border-line p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-line/40" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-28 h-3 rounded-full bg-line/40" />
                  <div className="w-16 h-2 rounded-full bg-line/30" />
                </div>
              </div>
              <div className="w-full aspect-square rounded-2xl bg-line/30" />
              <div className="space-y-2 pt-2">
                <div className="w-32 h-3 rounded-full bg-line/40" />
                <div className="w-48 h-2 rounded-full bg-line/30" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        // Empty State: Follow people to see posts
        <div className="bg-card rounded-3xl border border-line p-8 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto text-2xl">
            ✨
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-ink">Welcome to your Feed!</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Follow creators, friends, and accounts in Explore to see their latest photos, videos,
              and stories right here.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate('/social/explore')}
              className="px-4 py-2 rounded-xl bg-brand-gradient text-white text-xs font-bold shadow-md hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Creators</span>
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('post')}
              className="px-4 py-2 rounded-xl bg-card border border-line text-ink text-xs font-bold hover:border-primary hover:text-primary transition flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-primary" />
              <span>Create First Post</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => {
            const isLast = index === posts.length - 1;
            return (
              <div key={post._id} ref={isLast ? lastPostRef : null}>
                <PostCard post={post} onPostDeleted={handlePostDeleted} />
              </div>
            );
          })}

          {/* Fetching more indicator */}
          {isFetchingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
