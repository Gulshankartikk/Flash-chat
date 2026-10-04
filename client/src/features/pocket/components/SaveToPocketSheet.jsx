import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Folder, Tag, X, Check, Loader2, Undo2, ExternalLink } from 'lucide-react';
import { fetchPocketFolders } from '../api/pocketApi';
import { useSaveToPocket } from '../hooks/useSaveToPocket';

export const SaveToPocketSheet = ({
  isOpen,
  onClose,
  target, // { from: 'chat_message' | 'social_post' | 'social_reel' | 'url', refId, url, text, title }
  onSaved
}) => {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [customNote, setCustomNote] = useState('');

  const { saveToPocket, isSaving, toast, closeToast } = useSaveToPocket();

  useEffect(() => {
    if (isOpen) {
      fetchPocketFolders()
        .then((res) => setFolders(res.folders || []))
        .catch(() => {});
      setTags([]);
      setTagInput('');
      setCustomNote('');
      setSelectedFolder('');
    }
  }, [isOpen]);

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleConfirmSave = async (e) => {
    e.preventDefault();
    if (!target) return;

    const payload = {
      from: target.from,
      refId: target.refId,
      url: target.url,
      text: customNote ? `${customNote}\n\n${target.text || ''}` : target.text,
      folderId: selectedFolder || null,
      tags
    };

    const res = await saveToPocket(payload);
    if (res.success) {
      onSaved?.(res.item);
      onClose?.();
    }
  };

  return (
    <>
      {/* Toast popup */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1F2937] text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-3 text-xs"
          >
            <div className="w-6 h-6 rounded-lg bg-[#F97316] flex items-center justify-center text-white">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold">{toast.message}</span>

            {toast.onUndo && (
              <button
                onClick={toast.onUndo}
                className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-400 font-bold flex items-center gap-1 transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                <span>Undo</span>
              </button>
            )}

            {toast.onOpen && (
              <button
                onClick={toast.onOpen}
                className="px-2 py-1 rounded-lg bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white font-bold flex items-center gap-1"
              >
                <span>Open</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button onClick={closeToast} className="text-gray-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#FED7AA] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] text-[#F97316] flex items-center justify-center border border-[#FED7AA]">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#1F2937]">Save to Pocket</h3>
                    <p className="text-[11px] text-[#6B7280]">Add to your private vault</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg text-[#6B7280] hover:text-[#1F2937]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {target?.title && (
                <div className="p-2.5 bg-[#FFF7ED] rounded-xl border border-[#FED7AA]/60 text-xs text-[#1F2937] font-medium truncate">
                  "{target.title}"
                </div>
              )}

              <form onSubmit={handleConfirmSave} className="space-y-3">
                {/* Folder dropdown */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1">Choose Folder</label>
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#1F2937] focus:outline-none"
                  >
                    <option value="">General (No Folder)</option>
                    {folders.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1">Personal Note (Optional)</label>
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Add a quick note..."
                    className="w-full text-xs p-2.5 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#1F2937] focus:outline-none placeholder:text-[#6B7280]"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1">Tags</label>
                  <div className="flex flex-wrap items-center gap-1 mb-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-lg bg-[#FFF7ED] text-[10px] font-bold text-[#F97316] border border-[#FED7AA] flex items-center gap-1"
                      >
                        #{t}
                        <button type="button" onClick={() => handleRemoveTag(t)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="+ Add tag..."
                      className="w-full text-xs p-2 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#1F2937] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-1 bg-white border border-[#FED7AA] rounded-xl text-xs font-bold text-[#1F2937]"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs font-semibold text-[#6B7280]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save to Pocket</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
