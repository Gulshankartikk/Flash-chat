import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, Layers, Play } from 'lucide-react';
import { fetchHashtagPosts } from '../api/api';
import { PostViewerModal } from '../components/PostViewerModal';

export const HashtagPage = () => {
  const { tag } = useParams();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);

  const [activePostId, setActivePostId] = useState(null);
  const observerRef = useRef(null);

  const loadTagPosts = useCallback(
    async (cursor = null) => {
      if (!tag) return;
      try {
        if (!cursor) setLoading(true);
        else setFetchingMore(true);

        const res = await fetchHashtagPosts(tag, { cursor, limit: 18 });
        if (res.success) {
          const items = res.data || [];
          setPosts((prev) => (cursor ? [...prev, ...items] : items));
          setTotalCount(res.postsCount || 0);
          setNextCursor(res.nextCursor || null);
          setHasMore(Boolean(res.hasMore));
        }
      } catch (err) {
        console.error('Failed to load hashtag posts:', err);
      } finally {
        setLoading(false);
        setFetchingMore(false);
      }
    },
    [tag]
  );

  useEffect(() => {
    loadTagPosts();
  }, [loadTagPosts]);

  // Infinite scroll
  const lastItemRef = useCallback(
    (node) => {
      if (loading || fetchingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && nextCursor) {
          loadTagPosts(nextCursor);
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, fetchingMore, hasMore, nextCursor, loadTagPosts]
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
      {/* Top Header */}
      <div className="bg-white rounded-3xl border border-[#FED7AA]/60 p-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-orange-50 text-[#1F2937] transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white flex items-center justify-center font-black text-xl shadow-md shadow-orange-500/15">
          #
        </div>

        <div>
          <h2 className="text-base font-extrabold text-[#1F2937]">#{tag}</h2>
          <p className="text-xs text-[#6B7280]">
            {totalCount} {totalCount === 1 ? 'post' : 'posts'}
          </p>
        </div>
      </div>

      {/* Grid of Posts */}
      <div className="bg-white rounded-3xl border border-[#FED7AA]/60 p-2 sm:p-3 shadow-xs">
        {loading ? (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-[#FED7AA]/30 animate-pulse"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280] space-y-2">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center mx-auto text-xl font-bold">
              #
            </div>
            <p className="text-xs font-bold text-[#1F2937]">No posts with #{tag} yet</p>
            <p className="text-[11px] text-[#6B7280]">
              Be the first to share a post with this hashtag!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {posts.map((post, index) => {
              const isLast = index === posts.length - 1;
              const firstMedia = post.media?.[0];
              const isVideo = firstMedia?.type === 'video';
              const isMulti = post.media?.length > 1;

              return (
                <div
                  key={post._id}
                  ref={isLast ? lastItemRef : null}
                  onClick={() => setActivePostId(post._id)}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 cursor-pointer group select-none shadow-xs"
                >
                  <img
                    src={firstMedia?.thumbnail || firstMedia?.url}
                    alt="Hashtag post"
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badges */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isVideo && (
                      <div className="w-5 h-5 rounded-full bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                        <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                      </div>
                    )}
                    {isMulti && (
                      <div className="w-5 h-5 rounded-full bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                        <Layers className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Hover overlay with likes */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                    <span>❤️ {post.likesCount || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fetchingMore && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Post Viewer Modal */}
      <PostViewerModal
        postId={activePostId}
        isOpen={Boolean(activePostId)}
        onClose={() => setActivePostId(null)}
      />
    </div>
  );
};
