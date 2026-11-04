import { create } from 'zustand';
import api from '../../services/api';

const OFFLINE_CONTACTS_KEY = 'flash_chat_offline_contacts';

function getStoredOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveStoredOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_CONTACTS_KEY, JSON.stringify(queue));
  } catch (_) {}
}

export const useContactsStore = create((set, get) => ({
  contacts: [],
  isLoading: false,
  error: null,
  offlineQueue: getStoredOfflineQueue(),

  fetchContacts: async () => {
    const token = localStorage.getItem('flash_chat_token');
    if (!token || token === 'null' || token === 'undefined') {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/contacts');
      set({ contacts: res.data.contacts || [], isLoading: false });
    } catch (err) {
      set({
        error: err.response?.data?.message || err.message || 'Failed to fetch contacts',
        isLoading: false
      });
    }
  },

  addContact: async (contactData) => {
    // If offline, queue it optimistically
    if (!navigator.onLine) {
      const tempId = `offline_${Date.now()}`;
      const optimisticContact = { ...contactData, _id: tempId, isOffline: true };
      const newQueue = [...get().offlineQueue, contactData];
      saveStoredOfflineQueue(newQueue);
      set((state) => ({
        contacts: [optimisticContact, ...state.contacts],
        offlineQueue: newQueue
      }));
      return { contact: optimisticContact, isOffline: true };
    }

    try {
      const res = await api.post('/contacts', contactData);
      const newContact = res.data.contact;
      set((state) => ({
        contacts: [newContact, ...state.contacts.filter((c) => c._id !== newContact._id)]
      }));
      return { contact: newContact };
    } catch (err) {
      throw err;
    }
  },

  updateContact: async (id, patch) => {
    // Optimistic update
    const previous = get().contacts;
    set({
      contacts: previous.map((c) => (c._id === id ? { ...c, ...patch } : c))
    });

    try {
      const res = await api.patch(`/contacts/${id}`, patch);
      const updated = res.data.contact;
      set((state) => ({
        contacts: state.contacts.map((c) => (c._id === id ? updated : c))
      }));
      return updated;
    } catch (err) {
      // Rollback on failure
      set({ contacts: previous });
      throw err;
    }
  },

  deleteContact: async (id) => {
    const previous = get().contacts;
    const deleted = previous.find((c) => c._id === id);
    set({ contacts: previous.filter((c) => c._id !== id) });

    try {
      await api.delete(`/contacts/${id}`);
      return deleted;
    } catch (err) {
      set({ contacts: previous });
      throw err;
    }
  },

  restoreContact: async (contact) => {
    if (!contact) return;
    try {
      const res = await api.post('/contacts', {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        note: contact.note,
        isFavorite: contact.isFavorite
      });
      const restored = res.data.contact;
      set((state) => ({
        contacts: [restored, ...state.contacts.filter((c) => c._id !== restored._id)]
      }));
      return restored;
    } catch (err) {
      throw err;
    }
  },

  importBulkContacts: async (contactsList) => {
    try {
      const res = await api.post('/contacts/bulk', { contacts: contactsList });
      await get().fetchContacts();
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  startChatWithContact: async (contactId) => {
    const res = await api.post(`/contacts/${contactId}/message`);
    return res.data.conversation || res.data;
  },


  inviteContact: async (contactId, channel = 'sms') => {
    const res = await api.post(`/contacts/${contactId}/invite`, { channel });
    return res.data;
  },

  clearOfflineQueue: () => {
    try {
      localStorage.removeItem(OFFLINE_CONTACTS_KEY);
    } catch (_) {}
    set({ offlineQueue: [], contacts: [] });
  },

  syncOfflineContacts: async () => {
    const token = localStorage.getItem('flash_chat_token');
    if (!token || token === 'null' || token === 'undefined') return;

    const queue = get().offlineQueue;
    if (!queue || queue.length === 0) return;

    const remaining = [];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        await api.post('/contacts', item);
      } catch (err) {
        if (err.response?.status === 401 || err.message?.includes('Authentication required')) {
          remaining.push(...queue.slice(i));
          break;
        }
        remaining.push(item);
      }
    }
    saveStoredOfflineQueue(remaining);
    set({ offlineQueue: remaining });
    if (remaining.length < queue.length) {
      await get().fetchContacts();
    }
  }
}));

// Listen for network reconnect to sync offline contacts
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useContactsStore.getState().syncOfflineContacts();
  });
  window.addEventListener('flash_chat_auth_logout', () => {
    try {
      localStorage.removeItem(OFFLINE_CONTACTS_KEY);
    } catch (_) {}
    useContactsStore.setState({ contacts: [], offlineQueue: [] });
  });
}
