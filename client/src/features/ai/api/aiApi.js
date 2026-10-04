import api from '../../../services/api';

/**
 * 1. AI Usage & Limits
 */
export const fetchAiUsage = async () => {
  const response = await api.get('/ai/usage');
  return response.data.data;
};

/**
 * 2. AI Conversations (AI Tab)
 */
export const fetchAiConversations = async () => {
  const response = await api.get('/ai/chats');
  return response.data.data;
};

export const fetchAiConversation = async (id) => {
  const response = await api.get(`/ai/chats/${id}`);
  return response.data.data;
};

export const createAiConversation = async ({ title = 'New Chat', systemPrompt = '' } = {}) => {
  const response = await api.post('/ai/chats', { title, systemPrompt });
  return response.data.data;
};

export const updateAiConversation = async (id, updates) => {
  const response = await api.patch(`/ai/chats/${id}`, updates);
  return response.data.data;
};

export const deleteAiConversation = async (id) => {
  const response = await api.delete(`/ai/chats/${id}`);
  return response.data;
};

export const deleteAllAiConversations = async () => {
  const response = await api.delete('/ai/chats');
  return response.data;
};

export const submitAiFeedback = async ({ conversationId, messageId, rating }) => {
  const response = await api.post('/ai/feedback', { conversationId, messageId, rating });
  return response.data;
};

/**
 * 3. Chat AI Enhancements
 */
export const fetchSmartReplies = async ({ conversationId, lastN = 10 }) => {
  const response = await api.post('/ai/chat/smart-replies', { conversationId, lastN });
  return response.data.data;
};

export const fetchChatSummary = async ({ conversationId, range = 'last50' }) => {
  const response = await api.post('/ai/chat/summarize', { conversationId, range });
  return response.data.data;
};

export const translateChatMessage = async ({ messageId, text, targetLang = 'English' }) => {
  const response = await api.post('/ai/chat/translate', { messageId, text, targetLang });
  return response.data.data;
};

export const rewriteChatMessage = async ({ text, tone = 'friendly' }) => {
  const response = await api.post('/ai/chat/rewrite', { text, tone });
  return response.data.data;
};

/**
 * 4. Social AI Enhancements
 */
export const generateSocialCaption = async ({ description, tone = 'engaging', mediaUrl }) => {
  const response = await api.post('/ai/social/caption', { description, tone, mediaUrl });
  return response.data.data;
};

export const suggestSocialHashtags = async ({ caption }) => {
  const response = await api.post('/ai/social/hashtags', { caption });
  return response.data.data;
};

export const suggestSocialCommentReplies = async ({ commentId, commentText, postCaption }) => {
  const response = await api.post('/ai/social/comment-replies', { commentId, commentText, postCaption });
  return response.data.data;
};

export const moderateSocialContent = async ({ text, mediaUrl }) => {
  const response = await api.post('/ai/social/moderate', { text, mediaUrl });
  return response.data.data;
};

export const describeSocialImage = async ({ mediaUrl, prompt }) => {
  const response = await api.post('/ai/social/describe', { mediaUrl, prompt });
  return response.data.data;
};

/**
 * 5. Pocket AI Enhancements
 */
export const summarizePocketItem = async ({ itemId }) => {
  const response = await api.post('/ai/pocket/summarize', { itemId });
  return response.data.data;
};

export const autoTagPocketItem = async ({ itemId }) => {
  const response = await api.post('/ai/pocket/auto-tag', { itemId });
  return response.data.data;
};

export const askPocketRAG = async ({ question }) => {
  const response = await api.post('/ai/pocket/ask', { question });
  return response.data.data;
};
