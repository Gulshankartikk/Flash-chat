import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { fetchPostById } from '../api/api';
import { PostCard } from '../components/PostCard';

export const PostDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPostById(id)
      .then((res) => {
        if (res.success && res.data) {
          setPost(res.data);
        } else {
          setError('Post not found.');
        }
      })
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? 'This post is no longer available or was deleted.'
            : 'Failed to load post.'
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-2 py-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-primary/10 text-ink transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-ink">Post</span>
      </div>

      {loading ? (
        <div className="bg-card rounded-3xl border border-line p-6 flex items-center justify-center aspect-square animate-pulse">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-card rounded-3xl border border-line p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-accent mx-auto stroke-1" />
          <h3 className="text-sm font-bold text-ink">{error}</h3>
          <p className="text-xs text-muted">
            The post may have been removed or you do not have permission to view it.
          </p>
          <button
            type="button"
            onClick={() => navigate('/social')}
            className="px-4 py-2 rounded-xl bg-brand-gradient text-white text-xs font-bold shadow-xs hover:opacity-95 cursor-pointer"
          >
            Back to Feed
          </button>
        </div>
      ) : (
        post && <PostCard post={post} onPostDeleted={() => navigate('/social')} />
      )}
    </div>
  );
};
