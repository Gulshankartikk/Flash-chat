import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { fetchPostById } from '../api/api';
import { PostCard } from './PostCard';

export const PostViewerModal = ({ postId, isOpen, onClose }) => {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && postId) {
      setLoading(true);
      setError(null);
      fetchPostById(postId)
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
              ? 'This post is no longer available.'
              : 'Failed to load post.'
          );
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, postId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs"
        />

        {/* Modal content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {loading ? (
            <div className="w-full aspect-square rounded-3xl bg-white border border-[#FED7AA] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="w-full p-8 rounded-3xl bg-white border border-[#FED7AA] text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#F43F5E] mx-auto stroke-1" />
              <h3 className="text-sm font-bold text-[#1F2937]">{error}</h3>
              <p className="text-xs text-[#6B7280]">
                It may have been deleted or account privacy settings were updated.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#FFF7ED] text-[#F97316] text-xs font-bold hover:bg-orange-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            post && <PostCard post={post} onPostDeleted={onClose} />
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
