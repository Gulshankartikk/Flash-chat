import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Search,
  HardDrive,
  FolderPlus,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Sparkles,
  Folder,
  Trash2,
  Tag,
  Star,
  Settings,
  X,
  Filter
} from 'lucide-react';
import {
  fetchPocketItems,
  fetchPocketFolders,
  createPocketFolder,
  fetchPocketStorage,
  updatePocketItem,
  deletePocketItem,
  bulkActionPocketItems
} from '../api/pocketApi';
import { usePocketStore } from '../store/usePocketStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { autoTagPocketItem } from '../../ai';
import { QuickAddBar } from '../components/QuickAddBar';
import { ItemCard } from '../components/ItemCard';
import { PinPadModal } from '../components/PinPadModal';

const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'notes', label: 'Notes' },
  { id: 'links', label: 'Links' },
  { id: 'media', label: 'Media' },
  { id: 'documents', label: 'Documents' },
  { id: 'voice', label: 'Voice' },
  { id: 'chats', label: 'From Chats' },
  { id: 'social', label: 'From Social' },
  { id: 'ai', label: 'AI' }
];

export const PocketHomePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Store state
  const {
    isUnlocked,
    lockVault,
    viewMode,
    setViewMode,
    isMultiSelectMode,
    toggleSelectMode,
    selectedIds,
    selectAllItems,
    clearSelection,
    activeFilter,
    setActiveFilter,
    activeFolderId,
    setActiveFolderId
  } = usePocketStore();

  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [storageData, setStorageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Modals & UI controls
  const [showPinModal, setShowPinModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#D946EF');
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef(null);

  // Load items
  const loadItems = useCallback(
    async (reset = true) => {
      const token = localStorage.getItem('flash_chat_token');
      if (!token || token === 'null' || token === 'undefined') return;

      try {
        if (reset) setIsLoading(true);
        else setIsLoadingMore(true);

        const params = {
          limit: 20,
          cursor: reset ? undefined : nextCursor,
          type: activeFilter === 'all' ? undefined : activeFilter === 'favorites' ? undefined : activeFilter === 'voice' ? 'audio' : activeFilter === 'notes' ? 'note' : activeFilter,
          favorite: activeFilter === 'favorites' ? 'true' : undefined,
          folder: activeFolderId || undefined,
          q: searchQuery.trim() || undefined
        };

        const res = await fetchPocketItems(params);
        if (reset) {
          setItems(res.items || []);
        } else {
          setItems((prev) => [...prev, ...(res.items || [])]);
        }
        setNextCursor(res.nextCursor);
        setHasMore(!!res.hasMore);
      } catch (err) {
        if (!err.message?.includes('Authentication required')) {
          console.error('Failed to load pocket items', err);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeFilter, activeFolderId, searchQuery, nextCursor]
  );

  // Initial load
  useEffect(() => {
    loadItems(true);
  }, [activeFilter, activeFolderId, searchQuery]);

  // Load Folders & Storage Metrics
  const loadMetadata = useCallback(async () => {
    const token = localStorage.getItem('flash_chat_token');
    if (!token || token === 'null' || token === 'undefined') return;

    try {
      const [foldersRes, storageRes] = await Promise.all([
        fetchPocketFolders(),
        fetchPocketStorage()
      ]);
      setFolders(foldersRes.folders || []);
      setStorageData(storageRes.storage || null);
    } catch (err) {
      if (!err.message?.includes('Authentication required')) {
        console.error('Failed to load pocket metadata', err);
      }
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Saved item highlighting from deep-link query param ?saved=<itemId>
  const savedItemId = searchParams.get('saved');
  const [highlightedId, setHighlightedId] = useState(savedItemId || null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    if (savedItemId) {
      setHighlightedId(savedItemId);
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [savedItemId]);

  // Online / Offline listener & auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      const { syncOfflineNotes } = await import('../utils/offlineQueue');
      const synced = await syncOfflineNotes((tempId, newItem) => {
        setItems((prev) => [newItem, ...prev.filter((i) => i._id !== tempId)]);
      });
      if (synced.length > 0) {
        loadMetadata();
      }
    };

    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadMetadata]);

  // Global Paste URL Listener
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const pasted = e.clipboardData?.getData('text');
      if (pasted && (pasted.startsWith('http://') || pasted.startsWith('https://'))) {
        // Handled or focused
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Item created callback
  const handleItemCreated = (newItem) => {
    setItems((prev) => [newItem, ...prev]);
    loadMetadata();
  };

  // Toggle Favorite
  const handleToggleFavorite = async (item) => {
    const nextVal = !item.isFavorite;
    setItems((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, isFavorite: nextVal } : i))
    );
    try {
      await updatePocketItem(item._id, { isFavorite: nextVal });
    } catch (e) {
      // rollback
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, isFavorite: item.isFavorite } : i))
      );
    }
  };

  // Toggle Pin
  const handleTogglePin = async (item) => {
    const nextVal = !item.isPinned;
    setItems((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, isPinned: nextVal } : i))
    );
    try {
      await updatePocketItem(item._id, { isPinned: nextVal });
    } catch (e) {
      // rollback
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, isPinned: item.isPinned } : i))
      );
    }
  };

  // Soft delete item
  const handleDeleteItem = async (item) => {
    const original = [...items];
    setItems((prev) => prev.filter((i) => i._id !== item._id));
    try {
      await deletePocketItem(item._id);
    } catch (e) {
      setItems(original);
      alert('Failed to delete item.');
    }
  };

  // Create new folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await createPocketFolder({
        name: newFolderName.trim(),
        color: newFolderColor
      });
      setFolders((prev) => [...prev, res.folder]);
      setNewFolderName('');
      setShowNewFolderModal(false);
    } catch (err) {
      alert(err.message || 'Failed to create folder');
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (window.confirm(`Move ${selectedIds.length} items to trash?`)) {
      try {
        await bulkActionPocketItems({
          ids: selectedIds,
          action: 'delete'
        });
        setItems((prev) => prev.filter((i) => !selectedIds.includes(i._id)));
        clearSelection();
      } catch (e) {
        alert('Bulk delete failed.');
      }
    }
  };

  const handleBulkFavorite = async () => {
    try {
      await bulkActionPocketItems({
        ids: selectedIds,
        action: 'favorite',
        isFavorite: true
      });
      setItems((prev) =>
        prev.map((i) => (selectedIds.includes(i._id) ? { ...i, isFavorite: true } : i))
      );
      clearSelection();
    } catch (e) {
      alert('Bulk favorite failed.');
    }
  };

  const { user } = useAuthStore();
  const aiEnabled = user?.aiSettings?.aiEnabled ?? true;

  const [isBulkAutoTagging, setIsBulkAutoTagging] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  const handleBulkAutoTag = async () => {
    const targets = selectedIds.slice(0, 10);
    if (targets.length === 0) return;

    setIsBulkAutoTagging(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const id = targets[i];
      setBulkProgress(`${i + 1}/${targets.length}`);
      try {
        const res = await autoTagPocketItem({ itemId: id });
        if (res?.tags) {
          setItems((prev) =>
            prev.map((it) => (it._id === id ? { ...it, tags: res.tags, aiTags: res.aiTags } : it))
          );
          successCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setIsBulkAutoTagging(false);
    setBulkProgress('');
    clearSelection();
    alert(`Auto-tagging complete: ${successCount} items tagged${failCount > 0 ? `, ${failCount} skipped/failed` : ''}.`);
  };

  // Format storage string
  const formatMB = (bytes = 0) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  // Partition pinned vs regular items
  const pinnedItems = items.filter((i) => i.isPinned);
  const regularItems = items.filter((i) => !i.isPinned);

  return (
    <div className="min-h-screen bg-canvas text-ink p-3 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-300 font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>You are currently offline. Notes will be saved locally and synced automatically when reconnected.</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 sm:p-5 rounded-3xl border border-line shadow-sm">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-md">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-ink">Pocket</h1>
              <p className="text-[11px] text-muted">Your private encrypted vault</p>
            </div>
          </div>

          {/* Lock / Unlock Icon Button */}
          <button
            onClick={() => {
              if (isUnlocked) {
                lockVault();
              } else {
                setShowPinModal(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
              isUnlocked
                ? 'bg-cream text-primary border-primary'
                : 'bg-card text-muted border-line'
            }`}
          >
            {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{isUnlocked ? 'Vault Unlocked' : 'Unlock Vault'}</span>
          </button>
        </div>

        {/* Storage Meter */}
        {storageData && (
          <div className="flex items-center gap-3">
            <div className="space-y-1 min-w-[140px]">
              <div className="flex justify-between text-[11px] font-bold text-ink">
                <span>Storage</span>
                <span>
                  {formatMB(storageData.usedBytes)} of {formatMB(storageData.limitBytes)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-canvas border border-line overflow-hidden">
                <div
                  className="h-full bg-brand-gradient transition-all duration-300"
                  style={{ width: `${Math.min(100, storageData.percent || 0)}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => navigate('/pocket/settings')}
              aria-label="Pocket Settings"
              className="p-2 rounded-xl text-muted hover:text-ink hover:bg-primary/10 border border-transparent hover:border-line transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search Input Bar & Ask AI Entry */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, links, tags, text... (Press '/' to focus)"
            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-card border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {aiEnabled && (
          <button
            onClick={() => navigate('/pocket/search?mode=ask')}
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-brand-gradient text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex-shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Ask my Pocket</span>
          </button>
        )}
      </div>

      {/* Quick-Add Action Bar */}
      <QuickAddBar onItemCreated={handleItemCreated} folders={folders} />

      {/* Folders Row (Horizontal) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveFolderId(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex-shrink-0 ${
            activeFolderId === null
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-sm'
              : 'bg-card text-ink border border-line hover:bg-primary/10'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>All Items</span>
        </button>

        {folders.map((f) => (
          <button
            key={f._id}
            onClick={() => setActiveFolderId(f._id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex-shrink-0 ${
              activeFolderId === f._id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-card text-ink border border-line hover:bg-primary/10'
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: f.color || '#D946EF' }}
            />
            <span>{f.name}</span>
            {f.itemCount !== undefined && (
              <span className="text-[10px] opacity-75 font-semibold">({f.itemCount})</span>
            )}
          </button>
        ))}

        <button
          onClick={() => setShowNewFolderModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-card text-primary border border-dashed border-line hover:bg-primary/10 transition-colors flex-shrink-0"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Filter Chips & View Mode Controls */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === chip.id
                  ? 'bg-brand-gradient text-white shadow-sm'
                  : 'bg-card text-muted hover:text-ink border border-line'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* View Layout & Multi-select Toggles */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toggleSelectMode()}
            aria-label="Multi-select mode"
            className={`p-2 rounded-xl border transition-colors ${
              isMultiSelectMode
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-muted border-line hover:text-ink'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'masonry' ? 'list' : 'masonry')}
            aria-label="Toggle layout view"
            className="p-2 rounded-xl bg-card border border-line text-muted hover:text-ink transition-colors"
          >
            {viewMode === 'masonry' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-44 bg-card rounded-3xl border border-line p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-line/50 rounded w-1/3" />
              <div className="h-3 bg-line/40 rounded w-3/4" />
              <div className="h-16 bg-canvas rounded-2xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="bg-card rounded-3xl p-10 border border-line shadow-sm text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-canvas border border-line flex items-center justify-center text-3xl mx-auto shadow-sm">
            🗄️
          </div>
          <h3 className="text-base font-black text-ink">Your private space. Only you can see this.</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Store notes, links, voice memos, files, or tap "Save to Pocket" from any Chat or Social post.
          </p>
        </div>
      )}

      {/* Pinned Items Section */}
      {!isLoading && pinnedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <span>PINNED ITEMS</span>
          </div>
          <div
            className={`grid gap-4 ${
              viewMode === 'masonry' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
            }`}
          >
            {pinnedItems.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                onToggleFavorite={handleToggleFavorite}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteItem}
                onRequireUnlock={() => setShowPinModal(true)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Items Section */}
      {!isLoading && regularItems.length > 0 && (
        <div className="space-y-2">
          {pinnedItems.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B7280]">
              <span>ALL ITEMS</span>
            </div>
          )}
          <div
            className={`grid gap-4 ${
              viewMode === 'masonry' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
            }`}
          >
            {regularItems.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                onToggleFavorite={handleToggleFavorite}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteItem}
                onRequireUnlock={() => setShowPinModal(true)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Infinite Scroll Load More Button */}
      {!isLoading && hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => loadItems(false)}
            disabled={isLoadingMore}
            className="px-5 py-2.5 rounded-2xl bg-card border border-line text-xs font-bold text-ink hover:bg-primary/10 transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading more...' : 'Load older items'}
          </button>
        </div>
      )}

      {/* Multi-Select Floating Action Bar */}
      <AnimatePresence>
        {isMultiSelectMode && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-card text-ink px-5 py-3 rounded-3xl shadow-2xl flex items-center gap-4 border border-line"
          >
            <span className="text-xs font-bold">{selectedIds.length} selected</span>

            <div className="h-4 w-px bg-line" />

            <button
              onClick={handleBulkFavorite}
              className="flex items-center gap-1 text-xs font-semibold hover:text-amber-400 transition-colors cursor-pointer"
            >
              <Star className="w-3.5 h-3.5" />
              <span>Favorite</span>
            </button>

            {aiEnabled && (
              <button
                onClick={handleBulkAutoTag}
                disabled={isBulkAutoTagging}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-secondary transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isBulkAutoTagging ? `Tagging ${bulkProgress}...` : 'Auto-tag'}</span>
              </button>
            )}

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={clearSelection}
              className="p-1 rounded-full text-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl border border-line space-y-4"
            >
              <h3 className="text-sm font-black text-ink">Create New Folder</h3>
              <form onSubmit={handleCreateFolder} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Folder Name</label>
                  <input
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Work, Ideas, Finance..."
                    className="w-full text-xs p-3 rounded-2xl bg-canvas border border-line focus:outline-none focus:ring-2 focus:ring-primary/50 text-ink"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Color Tag</label>
                  <div className="flex items-center gap-2">
                    {['#D946EF', '#A855F7', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewFolderColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          newFolderColor === c ? 'scale-125 ring-2 ring-offset-2 ring-primary' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewFolderModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-brand-gradient text-white text-xs font-bold shadow-md"
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pin Pad Modal for unlocking vault */}
      <PinPadModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => loadItems(true)}
        mode="unlock"
      />
    </div>
  );
};

export default PocketHomePage;
