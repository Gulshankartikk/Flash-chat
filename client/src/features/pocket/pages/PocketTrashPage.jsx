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
    <div className="min-h-screen bg-[#FFF7ED] p-3 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/pocket')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#FED7AA] text-xs font-bold text-[#1F2937] hover:bg-[#FED7AA]/40 transition-colors shadow-sm"
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
                className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
                  isMultiSelect
                    ? 'bg-[#F97316] text-white border-[#F97316]'
                    : 'bg-white text-[#1F2937] border-[#FED7AA]'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              <button
                onClick={handleEmptyTrash}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Trash</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-white rounded-3xl border border-[#FED7AA] shadow-sm flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-[#1F2937]">Trash Auto-Cleanup</h2>
          <p className="text-[11px] text-[#6B7280] mt-0.5">
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
              className="h-20 bg-white rounded-3xl border border-[#FED7AA] p-4 animate-pulse"
            />
          ))}
        </div>
      ) : trashItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-[#FED7AA] text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-3xl mx-auto">
            🗑️
          </div>
          <h3 className="text-base font-black text-[#1F2937]">Trash is empty</h3>
          <p className="text-xs text-[#6B7280]">Deleted items will show up here before permanent removal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trashItems.map((item) => {
            const daysLeft = getDaysRemaining(item.deletedAt);
            const isSelected = selectedIds.includes(item._id);

            return (
              <div
                key={item._id}
                className={`bg-white rounded-3xl p-4 border transition-all shadow-sm flex items-center justify-between gap-4 ${
                  isSelected ? 'border-[#F97316] bg-[#FFF7ED]/30' : 'border-[#FED7AA]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isMultiSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item._id)}
                      className="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316] cursor-pointer"
                    />
                  )}

                  <div className="w-10 h-10 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#F97316] flex-shrink-0">
                    {item.type === 'note' && <FileText className="w-5 h-5" />}
                    {item.type === 'link' && <LinkIcon className="w-5 h-5" />}
                    {item.type === 'image' && <ImageIcon className="w-5 h-5 text-[#EC4899]" />}
                    {item.type === 'video' && <Play className="w-5 h-5 text-[#EC4899]" />}
                    {item.type === 'audio' && <Music className="w-5 h-5 text-[#F43F5E]" />}
                    {item.type === 'document' && <FileCheck className="w-5 h-5 text-[#F97316]" />}
                    {item.type === 'snippet' && <Code2 className="w-5 h-5 text-[#F97316]" />}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-[#1F2937] truncate">
                      {item.title || 'Untitled Item'}
                    </h4>
                    <p className="text-[11px] text-[#6B7280] line-clamp-1">
                      {item.content || 'No text content'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
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
                    className="p-2 rounded-xl bg-cream hover:bg-card text-primary border border-line transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item._id)}
                    title="Delete forever"
                    className="p-2 rounded-xl bg-cream hover:bg-card text-accent border border-line transition-colors"
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
