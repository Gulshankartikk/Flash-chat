import api from '../../../services/api';

/**
 * Pocket Feature API client
 */

// --- Items API ---
export const fetchPocketItems = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await api.get(`/pocket/items?${query.toString()}`);
  return res.data;
};

export const fetchPocketItemById = async (id) => {
  const res = await api.get(`/pocket/items/${id}`);
  return res.data;
};

export const createPocketItem = async (itemData) => {
  const res = await api.post('/pocket/items', itemData);
  return res.data;
};

export const updatePocketItem = async (id, itemData) => {
  const res = await api.patch(`/pocket/items/${id}`, itemData);
  return res.data;
};

export const deletePocketItem = async (id) => {
  const res = await api.delete(`/pocket/items/${id}`);
  return res.data;
};

export const bulkActionPocketItems = async (payload) => {
  const res = await api.post('/pocket/items/bulk', payload);
  return res.data;
};

// --- Trash API ---
export const fetchPocketTrash = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.cursor) query.append('cursor', params.cursor);
  if (params.limit) query.append('limit', params.limit);
  const res = await api.get(`/pocket/trash?${query.toString()}`);
  return res.data;
};

export const restorePocketItem = async (id) => {
  const res = await api.post(`/pocket/items/${id}/restore`);
  return res.data;
};

export const permanentDeletePocketItem = async (id) => {
  const res = await api.delete(`/pocket/items/${id}/permanent`);
  return res.data;
};

// --- Folders API ---
export const fetchPocketFolders = async () => {
  const res = await api.get('/pocket/folders');
  return res.data;
};

export const createPocketFolder = async (folderData) => {
  const res = await api.post('/pocket/folders', folderData);
  return res.data;
};

export const updatePocketFolder = async (id, folderData) => {
  const res = await api.patch(`/pocket/folders/${id}`, folderData);
  return res.data;
};

export const deletePocketFolder = async (id) => {
  const res = await api.delete(`/pocket/folders/${id}`);
  return res.data;
};

export const reorderPocketFolders = async (orders) => {
  const res = await api.post('/pocket/folders/reorder', { orders });
  return res.data;
};

// --- Tags API ---
export const fetchPocketTags = async () => {
  const res = await api.get('/pocket/tags');
  return res.data;
};

export const renamePocketTag = async (oldTag, newTag) => {
  const res = await api.post('/pocket/tags/rename', { oldTag, newTag });
  return res.data;
};

// --- Cross-linking: Save to Pocket ---
export const saveToPocketApi = async (payload) => {
  const res = await api.post('/pocket/save', payload);
  return res.data;
};

export const saveStarredMessagesApi = async (folderId = null) => {
  const res = await api.post('/pocket/save-starred', { folderId });
  return res.data;
};

// --- Link Preview ---
export const fetchLinkPreview = async (url) => {
  const res = await api.get(`/pocket/preview?url=${encodeURIComponent(url)}`);
  return res.data;
};

// --- Storage & Quota ---
export const fetchPocketStorage = async () => {
  const res = await api.get('/pocket/storage');
  return res.data;
};

// --- Vault PIN Security ---
export const setVaultPinApi = async ({ pin, currentPin }) => {
  const res = await api.post('/pocket/pin', { pin, currentPin });
  return res.data;
};

export const verifyVaultPinApi = async (pin) => {
  const res = await api.post('/pocket/pin/verify', { pin });
  return res.data;
};

export const removeVaultPinApi = async (pin) => {
  const res = await api.delete('/pocket/pin', { data: { pin } });
  return res.data;
};

// --- Search ---
export const searchPocketItems = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await api.get(`/pocket/search?${query.toString()}`);
  return res.data;
};

// --- Export Archive ---
export const startPocketExportApi = async () => {
  const res = await api.post('/pocket/export');
  return res.data;
};

export const fetchExportStatusApi = async (jobId) => {
  const res = await api.get(`/pocket/export/${jobId}`);
  return res.data;
};

// --- Upload Attachment ---
export const uploadPocketFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
};
