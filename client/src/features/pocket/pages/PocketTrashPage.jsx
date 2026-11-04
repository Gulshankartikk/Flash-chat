import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  CheckSquare,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Play,
  FileCheck,
  Music,
  Code2,
  Clock,
  X
} from 'lucide-react';
import {
  fetchPocketTrash,
  restorePocketItem,
  permanentDeletePocketItem,
  emptyPocketTrash
} from '../api/pocketApi';

export const PocketTrashPage = () => {
  const navigate = useNavigate();
  const [trashItems, setTrashItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  const loadTrash = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetchPocketTrash();
      setTrashItems(res.items || []);
    } catch (err) {
      console.error('Failed to load trash', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  // Calculate days remaining before auto-delete (30-day window)
  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return 30;
    const diffMs = Date.now() - new Date(deletedAt).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  // Restore single item
  const handleRestore = async (id) => {
    const original = [...trashItems];
    setTrashItems((prev) => prev.filter((i) => i._id !== id));
    try {
      await restorePocketItem(id);
    } catch (e) {
      setTrashItems(original);
      alert('Failed to restore item.');
    }
  };

  // Permanent delete single item
  const handlePermanentDelete = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this item? This action cannot be undone.')) {
      const original = [...trashItems];
      setTrashItems((prev) => prev.filter((i) => i._id !== id));
      try {
        await permanentDeletePocketItem(id);
      } catch (e) {
        setTrashItems(original);
        alert('Failed to permanently delete item.');
      }
    }
  };

  // Empty entire trash
  const handleEmptyTrash = async () => {
    if (window.confirm('Empty entire trash? All items will be permanently deleted forever.')) {
      try {
        await emptyPocketTrash();
        setTrashItems([]);
        setSelectedIds([]);
      } catch (e) {
        alert('Failed to empty trash.');
      }
    }
  };

  // Bulk restore
  const handleBulkRestore = async () => {
    const idsToRestore = [...selectedIds];
    setTrashItems((prev) => prev.filter((i) => !idsToRestore.includes(i._id)));
    setSelectedIds([]);
    try {
      await Promise.all(idsToRestore.map((id) => restorePocketItem(id)));
    } catch (e) {
      loadTrash();
    }
  };

  // Bulk permanent delete
  const handleBulkPermanentDelete = async () => {
    if (window.confirm(`Permanently delete ${selectedIds.length} items?`)) {
      const idsToDelete = [...selectedIds];
      setTrashItems((prev) => prev.filter((i) => !idsToDelete.includes(i._id)));
      setSelectedIds([]);
      try {
        await Promise.all(idsToDelete.map((id) => permanentDeletePocketItem(id)));
      } catch (e) {
        loadTrash();
      }
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-canvas p-3 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/pocket')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-line text-xs font-bold text-ink hover:bg-line/40 transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Pocket</span>
        </button>

        <div className="flex items-center gap-2">
          {trashItems.length > 0 && (
            <>
              <button
                onClick={() => {
                  setIsMultiSelect(!isMultiSelect);
                  setSelectedIds([]);
                }}
                className={`p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  isMultiSelect
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-ink border-line'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              <button
                onClick={handleEmptyTrash}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Trash</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-card rounded-3xl border border-line shadow-sm flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-ink">Trash Auto-Cleanup</h2>
          <p className="text-[11px] text-muted mt-0.5">
            Items moved to trash are automatically and permanently deleted after 30 days. You can restore them anytime
            before their expiration.
          </p>
        </div>
      </div>

      {/* Trash Items List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-20 bg-card rounded-3xl border border-line p-4 animate-pulse"
            />
          ))}
        </div>
      ) : trashItems.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 border border-line text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-canvas border border-line flex items-center justify-center text-3xl mx-auto">
            🗑️
          </div>
          <h3 className="text-base font-black text-ink">Trash is empty</h3>
          <p className="text-xs text-muted">Deleted items will show up here before permanent removal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trashItems.map((item) => {
            const daysLeft = getDaysRemaining(item.deletedAt);
            const isSelected = selectedIds.includes(item._id);

            return (
              <div
                key={item._id}
                className={`bg-card rounded-3xl p-4 border transition-all shadow-sm flex items-center justify-between gap-4 ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-line'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isMultiSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item._id)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  )}

                  <div className="w-10 h-10 rounded-2xl bg-canvas border border-line flex items-center justify-center text-primary flex-shrink-0">
                    {item.type === 'note' && <FileText className="w-5 h-5" />}
                    {item.type === 'link' && <LinkIcon className="w-5 h-5" />}
                    {item.type === 'image' && <ImageIcon className="w-5 h-5 text-primary" />}
                    {item.type === 'video' && <Play className="w-5 h-5 text-primary" />}
                    {item.type === 'audio' && <Music className="w-5 h-5 text-rose-400" />}
                    {item.type === 'document' && <FileCheck className="w-5 h-5 text-secondary" />}
                    {item.type === 'snippet' && <Code2 className="w-5 h-5 text-secondary" />}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-ink truncate">
                      {item.title || 'Untitled Item'}
                    </h4>
                    <p className="text-[11px] text-muted line-clamp-1">
                      {item.content || 'No text content'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/30">
                        Auto-deletes in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(item._id)}
                    title="Restore item"
                    className="p-2 rounded-xl bg-canvas hover:bg-line/40 text-primary border border-line transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item._id)}
                    title="Delete forever"
                    className="p-2 rounded-xl bg-canvas hover:bg-line/40 text-accent border border-line transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-select Floating Bar */}
      <AnimatePresence>
        {isMultiSelect && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-card text-ink px-5 py-3 rounded-3xl shadow-2xl flex items-center gap-4 border border-line"
          >
            <span className="text-xs font-bold">{selectedIds.length} selected</span>

            <div className="h-4 w-px bg-line" />

            <button
              onClick={handleBulkRestore}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>

            <button
              onClick={handleBulkPermanentDelete}
              className="flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Forever</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PocketTrashPage;
