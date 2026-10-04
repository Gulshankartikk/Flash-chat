import { createPocketItem } from '../api/pocketApi';

const OFFLINE_QUEUE_KEY = 'flashchat_pocket_offline_notes';

export const getOfflineNotes = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const queueOfflineNote = (noteData) => {
  const current = getOfflineNotes();
  const tempItem = {
    ...noteData,
    _id: `offline_${Date.now()}`,
    type: 'note',
    isOfflinePending: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const updated = [tempItem, ...current];
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  return tempItem;
};

export const removeOfflineNote = (tempId) => {
  const current = getOfflineNotes();
  const updated = current.filter((n) => n._id !== tempId);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
};

export const clearOfflineNotes = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
};

export const syncOfflineNotes = async (onItemSynced) => {
  if (!navigator.onLine) return [];
  const queue = getOfflineNotes();
  if (queue.length === 0) return [];

  const syncedItems = [];
  const remaining = [];

  for (const item of queue) {
    try {
      const res = await createPocketItem({
        type: 'note',
        title: item.title,
        content: item.content,
        folder: item.folder || null,
        tags: item.tags || []
      });
      syncedItems.push(res.item);
      onItemSynced?.(item._id, res.item);
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return syncedItems;
};
