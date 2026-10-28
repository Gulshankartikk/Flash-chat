import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Play,
  Layers,
  History,
  TrendingUp,
  Users,
  Hash,
  FileText
} from 'lucide-react';
import { fetchExplore, searchSocialApi } from '../api/api';
import { SocialAvatar } from '../components/SocialAvatar';
import { PostViewerModal } from '../components/PostViewerModal';

const RECENT_SEARCHES_KEY = 'flash_social_recent_searches';

export const ExplorePage = () => {
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState('');
  const [searchTab, setSearchTab] = useState('users'); // 'users' | 'tags' | 'posts'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Explore grid state
  const [exploreItems, setExploreItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Selected item modal viewer
  const [activePostId, setActivePostId] = useState(null);

  const observerRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      setRecentSearches(saved);
    } catch (e) {
      setRecentSearches([]);
    }
  }, []);

  const saveRecentSearch = (item) => {
    // item: { type: 'user'|'tag', value: '', label: '' }
    const updated = [item, ...recentSearches.filter((s) => s.value !== item.value)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const removeRecentSearch = (value) => {
    const updated = recentSearches.filter((s) => s.value !== value);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Load Explore trending items
  const loadExplore = useCallback(async (cursor = null) => {
    try {
      if (!cursor) setLoading(true);
      else setFetchingMore(true);

      const res = await fetchExplore({ cursor, limit: 18 });
      if (res.success) {
        const items = res.data || [];
        setExploreItems((prev) => (cursor ? [...prev, ...items] : items));
        setNextCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
      }
    } catch (err) {
      console.error('Failed to load explore:', err);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  // Infinite scroll sentinel
  const lastItemRef = useCallback(
    (node) => {
      if (loading || fetchingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && nextCursor) {
          loadExplore(nextCursor);
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, fetchingMore, hasMore, nextCursor, loadExplore]
  );

  // Search execution with debounce
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchSocialApi({ q: query.trim(), type: searchTab });
        if (res.success) {
          setSearchResults(res.data || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, searchTab]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
      {/* Sticky Search Bar */}
      <div className="sticky top-14 z-20 bg-canvas/95 backdrop-blur-md pt-1 pb-2 space-y-2">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-card border border-line shadow-xs">
          <Search className="w-4 h-4 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, #hashtags, or posts..."
            className="w-full text-xs text-ink bg-transparent focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-muted hover:text-ink hover:bg-primary/10 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Filter Tabs (only when typing) */}
        {query.trim() && (
          <div className="flex items-center gap-1.5 px-1">
            {[
              { id: 'users', label: 'People', icon: Users },
              { id: 'tags', label: 'Tags', icon: Hash },
              { id: 'posts', label: 'Posts', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = searchTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSearchTab(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-brand-gradient text-white shadow-xs'
                      : 'bg-card border border-line text-muted hover:text-ink'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mode 1: Search Active */}
      {query.trim() ? (
        <div className="bg-card rounded-3xl border border-line p-4 shadow-xs">
          {isSearching ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-8 text-center text-muted text-xs">
              No results found for "{query}".
            </div>
          ) : (
            <div className="space-y-2">
              {searchTab === 'users' &&
                searchResults.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => {
                      saveRecentSearch({
                        type: 'user',
                        value: user.username,
                        label: user.name || user.username
                      });
                      navigate(`/u/${user.username}`);
                    }}
                    className="flex items-center justify-between p-2 rounded-2xl hover:bg-primary/10 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <SocialAvatar src={user.avatar} alt={user.username} size="sm" />
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-ink">
                            {user.username}
                          </span>
                          {user.isVerified && (
                            <span className="w-3 h-3 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted">{user.name}</span>
                      </div>
                    </div>
                    {user.followersCount !== undefined && (
                      <span className="text-[11px] text-muted">
                        {user.followersCount} followers
                      </span>
                    )}
                  </div>
                ))}

              {searchTab === 'tags' &&
                searchResults.map((t) => (
                  <div
                    key={t.tag}
                    onClick={() => {
                      saveRecentSearch({ type: 'tag', value: t.tag, label: `#${t.tag}` });
                      navigate(`/social/hashtag/${t.tag}`);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-primary/10 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-sm">
                        #
                      </div>
                      <div>
                        <span className="text-xs font-bold text-ink">#{t.tag}</span>
                        <p className="text-[10px] text-muted">{t.count} posts</p>
                      </div>
                    </div>
                  </div>
                ))}

              {searchTab === 'posts' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {searchResults.map((post) => (
                    <div
                      key={post._id}
                      onClick={() => setActivePostId(post._id)}
                      className="relative aspect-square rounded-xl overflow-hidden bg-neutral-900 cursor-pointer group"
                    >
                      <img
                        src={post.media?.[0]?.thumbnail || post.media?.[0]?.url}
                        alt="Post"
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Recent Searches (if any) */}
          {recentSearches.length > 0 && (
            <div className="bg-card rounded-3xl border border-line p-3.5 shadow-xs space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>Recent Searches</span>
                </span>
                <button
                  type="button"
                  onClick={clearAllRecent}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {recentSearches.map((item) => (
                  <div
                    key={item.value}
                    onClick={() => {
                      if (item.type === 'tag') navigate(`/social/hashtag/${item.value}`);
                      else navigate(`/u/${item.value}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-canvas border border-line text-xs font-semibold text-ink hover:border-primary transition cursor-pointer flex-shrink-0"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(item.value);
                      }}
                      className="text-muted hover:text-accent"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Masonry / Grid of Trending Posts */}
          <div className="bg-card rounded-3xl border border-line p-2 sm:p-3 shadow-xs">
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-ink">Trending & Discover</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl bg-line/30 animate-pulse"
                  />
                ))}
              </div>
            ) : exploreItems.length === 0 ? (
              <div className="py-12 text-center text-muted text-xs">
                No trending posts found. Start sharing!
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {exploreItems.map((item, index) => {
                  const isLast = index === exploreItems.length - 1;
                  const firstMedia = item.media?.[0];
                  const isVideo = firstMedia?.type === 'video' || item.type === 'reel';
                  const isMulti = item.media?.length > 1;

                  return (
                    <div
                      key={item._id}
                      ref={isLast ? lastItemRef : null}
                      onClick={() => {
                        if (item.type === 'reel') navigate('/social/reels');
                        else setActivePostId(item._id);
                      }}
                      className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 cursor-pointer group select-none shadow-xs"
                    >
                      <img
                        src={firstMedia?.thumbnail || firstMedia?.url}
                        alt="Explore item"
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Top right type badges */}
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

                      {/* Hover overlay with likes count */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                        <span>❤️ {item.likesCount || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {fetchingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </>
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
