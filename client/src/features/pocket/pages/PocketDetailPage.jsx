import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Check,
  Lock,
  Unlock,
  Pin,
  Star,
  Trash2,
  Folder,
  Tag,
  KeyRound,
  ShieldAlert,
  ExternalLink,
  ShieldCheck,
  Eye,
  AlertTriangle,
  Play,
  FileCheck
} from 'lucide-react';
import {
  fetchPocketItemById,
  updatePocketItem,
  deletePocketItem,
  fetchPocketFolders,
  fetchPocketTags
} from '../api/pocketApi';
import { encryptItemContent, decryptItemContent } from '../utils/crypto';
import { usePocketStore } from '../store/usePocketStore';

export const PocketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [folders, setFolders] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);

  // Decryption state
  const [decryptedText, setDecryptedText] = useState(null);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const { isUnlocked } = usePocketStore();
  const autosaveTimerRef = useRef(null);

  // Initial load
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const [itemRes, folderRes, tagRes] = await Promise.all([
          fetchPocketItemById(id),
          fetchPocketFolders(),
          fetchPocketTags()
        ]);

        if (!mounted) return;
        const it = itemRes.item;
        setItem(it);
        setTitle(it.title || '');
        setContent(it.content || '');
        setSelectedFolder(it.folder?._id || it.folder || '');
        setTags(it.tags || []);
        setIsFavorite(!!it.isFavorite);
        setIsPinned(!!it.isPinned);
        setIsLocked(!!it.isLocked);
        setIsEncrypted(!!it.isEncrypted);

        setFolders(folderRes.folders || []);
        setAvailableTags(tagRes.tags || []);
      } catch (err) {
        if (!mounted) return;
        setErrorMessage(err.message || 'Failed to load item.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Debounced Autosave (800ms) for notes/text
  const triggerAutosave = useCallback(
    (newFields = {}) => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      setSaveStatus('saving');

      autosaveTimerRef.current = setTimeout(async () => {
        try {
          const payload = {
            title,
            content: isEncrypted && decryptedText !== null ? content : content,
            folder: selectedFolder || null,
            tags,
            isFavorite,
            isPinned,
            isLocked,
            ...newFields
          };

          await updatePocketItem(id, payload);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
          setSaveStatus('error');
        }
      }, 800);
    },
    [id, title, content, selectedFolder, tags, isFavorite, isPinned, isLocked, isEncrypted, decryptedText]
  );

  // Decrypt content in-memory
  const handleDecrypt = async () => {
    setPassphraseError('');
    try {
      const plaintext = await decryptItemContent(
        item.content,
        item.encryption?.iv,
        item.encryption?.salt,
        passphraseInput
      );
      setDecryptedText(plaintext);
      setContent(plaintext);
    } catch (e) {
      setPassphraseError(e.message || 'Failed to decrypt content');
    }
  };

  // Encrypt item with passphrase
  const handleApplyEncryption = async (e) => {
    e.preventDefault();
    if (!newPassphrase || newPassphrase.length < 4) {
      alert('Passphrase must be at least 4 characters long.');
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      alert('Passphrases do not match.');
      return;
    }
    if (!acknowledgedWarning) {
      alert('Please confirm that you understand this item cannot be recovered if you forget the passphrase.');
      return;
    }

    try {
      const textToEncrypt = content;
      const { ciphertext, iv, salt } = await encryptItemContent(textToEncrypt, newPassphrase);

      await updatePocketItem(id, {
        content: ciphertext,
        isEncrypted: true,
        encryption: { iv, salt }
      });

      setIsEncrypted(true);
      setItem((prev) => ({
        ...prev,
        content: ciphertext,
        isEncrypted: true,
        encryption: { iv, salt }
      }));
      setDecryptedText(textToEncrypt);
      setShowEncryptModal(false);
      setNewPassphrase('');
      setConfirmPassphrase('');
      setSaveStatus('saved');
    } catch (err) {
      alert(err.message || 'Encryption failed');
    }
  };

  // Tag management
  const handleAddTag = (t) => {
    const clean = t.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      const nextTags = [...tags, clean];
      setTags(nextTags);
      triggerAutosave({ tags: nextTags });
    }
    setTagInput('');
  };

  const handleRemoveTag = (t) => {
    const nextTags = tags.filter((item) => item !== t);
    setTags(nextTags);
    triggerAutosave({ tags: nextTags });
  };

  const handleDelete = async () => {
    if (window.confirm('Move this item to trash? You can restore it anytime within 30 days.')) {
      try {
        await deletePocketItem(id);
        navigate('/pocket', { state: { toast: 'Item moved to trash' } });
      } catch (e) {
        alert(e.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF7ED]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#6B7280]">Loading item...</span>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1F2937]">Unable to load Pocket item</h2>
        <p className="text-xs text-[#6B7280]">{errorMessage}</p>
        <button
          onClick={() => navigate('/pocket')}
          className="px-4 py-2 rounded-2xl bg-[#F97316] text-white text-xs font-bold"
        >
          Back to Pocket
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF7ED] p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      {/* Top Navbar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/pocket')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#FED7AA] text-xs font-bold text-[#1F2937] hover:bg-[#FED7AA]/40 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Autosave status indicator */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-[11px] font-semibold text-[#6B7280] animate-pulse">Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}

          {/* Privacy badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-[10px] font-bold text-[#F97316]">
            <ShieldCheck className="w-3 h-3" />
            <span>Only you can see this</span>
          </div>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const nextFav = !isFavorite;
              setIsFavorite(nextFav);
              triggerAutosave({ isFavorite: nextFav });
            }}
            aria-label="Toggle Favorite"
            className="p-2 rounded-xl bg-white border border-[#FED7AA] text-[#6B7280] hover:text-amber-500 shadow-sm"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              const nextPin = !isPinned;
              setIsPinned(nextPin);
              triggerAutosave({ isPinned: nextPin });
            }}
            aria-label="Toggle Pin"
            className="p-2 rounded-xl bg-white border border-[#FED7AA] text-[#6B7280] hover:text-[#F97316] shadow-sm"
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-[#F97316] text-[#F97316]' : ''}`} />
          </button>

          <button
            onClick={() => {
              const nextLock = !isLocked;
              setIsLocked(nextLock);
              triggerAutosave({ isLocked: nextLock });
            }}
            aria-label="Toggle Lock"
            className="p-2 rounded-xl bg-white border border-[#FED7AA] text-[#6B7280] hover:text-[#F97316] shadow-sm"
          >
            {isLocked ? <Lock className="w-4 h-4 text-[#F97316]" /> : <Unlock className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDelete}
            aria-label="Delete item"
            className="p-2 rounded-xl bg-white border border-[#FED7AA] text-[#6B7280] hover:text-rose-600 shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Item Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm space-y-6">
        {/* Title Input */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              triggerAutosave({ title: e.target.value });
            }}
            placeholder="Item title..."
            className="w-full text-xl sm:text-2xl font-black text-[#1F2937] placeholder:text-[#6B7280]/60 focus:outline-none"
          />
        </div>

        {/* Metadata Bar (Folder picker & Date) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#FED7AA]/50 text-xs">
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-[#F97316]" />
            <select
              value={selectedFolder}
              onChange={(e) => {
                setSelectedFolder(e.target.value);
                triggerAutosave({ folder: e.target.value || null });
              }}
              className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-2.5 py-1 text-xs font-semibold text-[#1F2937] focus:outline-none"
            >
              <option value="">No Folder (General)</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[#6B7280] text-[11px]">
            Created on {new Date(item.createdAt).toLocaleDateString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </span>

          {/* Deep link button if saved from chat or social */}
          {item.source?.snapshot?.conversationId && (
            <button
              onClick={() => navigate(`/chats/${item.source.snapshot.conversationId}`)}
              className="ml-auto text-xs font-bold text-[#F97316] hover:underline flex items-center gap-1"
            >
              <span>Open in Chat</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {item.source?.kind === 'social_post' && item.source?.refId && (
            <button
              onClick={() => navigate(`/social/post/${item.source.refId}`)}
              className="ml-auto text-xs font-bold text-[#EC4899] hover:underline flex items-center gap-1"
            >
              <span>Open Original Post</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Client-Side Encryption Banner */}
        {isEncrypted && !decryptedText ? (
          <div className="p-6 rounded-2xl bg-purple-50 border border-purple-200 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-md">
              <KeyRound className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-purple-900">End-to-End Client Encrypted</h4>
            <p className="text-xs text-purple-700 max-w-md mx-auto">
              This item is encrypted with AES-GCM. The server does not possess the encryption key. Enter your
              passphrase to decrypt in memory.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-sm mx-auto">
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="Enter passphrase..."
                className="w-full text-xs p-2.5 rounded-xl border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button
                onClick={handleDecrypt}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-sm hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                Decrypt
              </button>
            </div>
            {passphraseError && <p className="text-xs text-rose-600 font-bold">{passphraseError}</p>}
          </div>
        ) : (
          /* Markdown / Text Content Editor */
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                triggerAutosave({ content: e.target.value });
              }}
              rows={12}
              placeholder="Start writing or typing markdown here..."
              className="w-full text-sm leading-relaxed p-4 rounded-2xl bg-[#FFF7ED]/50 border border-[#FED7AA]/60 text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 resize-y font-sans placeholder:text-[#6B7280]"
            />
          </div>
        )}

        {/* Media Attachments Viewer */}
        {item.media && item.media.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-[#FED7AA]/50">
            <h4 className="text-xs font-bold text-[#1F2937]">Attachments ({item.media.length})</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {item.media.map((m, idx) => (
                <div key={idx} className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA]/60 space-y-2">
                  {m.mimeType?.startsWith('image/') ? (
                    <img
                      src={m.url}
                      alt="Attachment"
                      className="w-full h-40 object-cover rounded-xl border border-[#FED7AA]/40"
                    />
                  ) : m.mimeType?.startsWith('video/') ? (
                    <video src={m.url} controls className="w-full h-40 rounded-xl bg-black" />
                  ) : m.mimeType?.startsWith('audio/') ? (
                    <audio src={m.url} controls className="w-full" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-6 h-6 text-amber-600" />
                      <span className="text-xs font-bold truncate text-[#1F2937]">Document</span>
                    </div>
                  )}
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F97316] hover:underline"
                  >
                    <span>View full file</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link Preview Card */}
        {item.type === 'link' && item.linkPreview && (
          <div className="p-4 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA] flex items-start gap-4">
            {item.linkPreview.image && (
              <img
                src={item.linkPreview.image}
                alt="Link preview"
                className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <h5 className="text-xs font-bold text-[#1F2937] truncate">{item.linkPreview.title}</h5>
              <p className="text-[11px] text-[#6B7280] line-clamp-2">{item.linkPreview.description}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#F97316] hover:underline pt-1"
              >
                <span>Open Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Tags Section */}
        <div className="space-y-2 pt-4 border-t border-[#FED7AA]/50">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2937]">
            <Tag className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Tags</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF7ED] text-xs font-bold text-[#F97316] border border-[#FED7AA]"
              >
                #{t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-rose-600 transition-colors ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}

            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddTag(tagInput);
                }
              }}
              placeholder="+ Add tag..."
              className="text-xs px-2.5 py-1 rounded-xl bg-transparent border border-dashed border-[#FED7AA] focus:outline-none focus:border-[#F97316] text-[#1F2937]"
            />
          </div>

          {/* Tag suggestions */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] text-[#6B7280]">Suggestions:</span>
              {availableTags.slice(0, 6).map((t) => (
                <button
                  key={t.name}
                  onClick={() => handleAddTag(t.name)}
                  className="text-[10px] font-semibold text-[#6B7280] hover:text-[#F97316] px-1.5 py-0.5 rounded bg-white border border-[#FED7AA]/60"
                >
                  #{t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Encrypt item button if not already encrypted */}
        {!isEncrypted && (
          <div className="pt-4 border-t border-[#FED7AA]/50">
            <button
              onClick={() => setShowEncryptModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors border border-purple-200"
            >
              <KeyRound className="w-4 h-4" />
              <span>Enable Client-Side Encryption for this item</span>
            </button>
          </div>
        )}
      </div>

      {/* Encryption Passphrase Setup Modal */}
      <AnimatePresence>
        {showEncryptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-purple-200 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1F2937]">Encrypt This Pocket Item</h3>
                  <p className="text-[11px] text-[#6B7280]">PBKDF2 + AES-GCM 256-bit client encryption</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Important Security Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  If you forget this passphrase, this item cannot be recovered under any circumstances. The server
                  never receives your passphrase or key.
                </p>
              </div>

              <form onSubmit={handleApplyEncryption} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1">Passphrase</label>
                  <input
                    type="password"
                    required
                    value={newPassphrase}
                    onChange={(e) => setNewPassphrase(e.target.value)}
                    placeholder="Enter encryption passphrase..."
                    className="w-full text-xs p-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1F2937] block mb-1">Confirm Passphrase</label>
                  <input
                    type="password"
                    required
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Re-enter passphrase..."
                    className="w-full text-xs p-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#6B7280]">
                  <input
                    type="checkbox"
                    checked={acknowledgedWarning}
                    onChange={(e) => setAcknowledgedWarning(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>I understand that forgotten passphrases cannot be recovered.</span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEncryptModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#6B7280]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!acknowledgedWarning || !newPassphrase}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-40"
                  >
                    Encrypt Item Now
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
