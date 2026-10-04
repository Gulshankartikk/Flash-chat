import { useState, useCallback } from 'react';
import * as aiApi from '../api/aiApi';

export const useAiTask = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const mapErrorMessage = (err) => {
    if (!navigator.onLine) {
      return {
        code: 'OFFLINE',
        message: 'You are currently offline. Please check your internet connection.'
      };
    }

    const response = err?.response?.data;
    const code = response?.code || err?.code;
    const serverMsg = response?.message || err?.message;

    switch (code) {
      case 'AI_RATE_LIMITED':
        return {
          code,
          message: serverMsg || 'AI daily limit or rate limit exceeded. Please wait before retrying.'
        };
      case 'AI_DISABLED':
        return {
          code,
          message: 'AI features are currently turned off. You can enable them in Profile > Privacy.'
        };
      case 'AI_CHATS_DISABLED':
        return {
          code,
          message: 'AI chat enhancements are turned off in your Privacy Settings.'
        };
      case 'AI_POCKET_OPT_IN_REQUIRED':
        return {
          code,
          message: 'To use AI with your Pocket vault, enable "AI can search my Pocket" in Settings > Privacy.'
        };
      case 'ENCRYPTED_ITEM_BLOCKED':
        return {
          code,
          message: 'Encrypted items cannot be processed by AI to preserve zero-knowledge security.'
        };
      case 'AI_BLOCKED':
        return {
          code,
          message: 'This request was blocked by AI safety guidelines.'
        };
      default:
        return {
          code: 'AI_UNAVAILABLE',
          message: serverMsg || 'AI service is temporarily unavailable. Please try again.'
        };
    }
  };

  const executeTask = useCallback(async (taskName, payload) => {
    setLoading(true);
    setError(null);

    try {
      let result = null;
      switch (taskName) {
        case 'smartReplies':
          result = await aiApi.fetchSmartReplies(payload);
          break;
        case 'summarizeChat':
          result = await aiApi.fetchChatSummary(payload);
          break;
        case 'translate':
          result = await aiApi.translateChatMessage(payload);
          break;
        case 'rewrite':
          result = await aiApi.rewriteChatMessage(payload);
          break;
        case 'caption':
          result = await aiApi.generateSocialCaption(payload);
          break;
        case 'hashtags':
          result = await aiApi.suggestSocialHashtags(payload);
          break;
        case 'commentReplies':
          result = await aiApi.suggestSocialCommentReplies(payload);
          break;
        case 'moderate':
          result = await aiApi.moderateSocialContent(payload);
          break;
        case 'summarizePocket':
          result = await aiApi.summarizePocketItem(payload);
          break;
        case 'autoTagPocket':
          result = await aiApi.autoTagPocketItem(payload);
          break;
        case 'askPocket':
          result = await aiApi.askPocketRAG(payload);
          break;
        default:
          throw new Error(`Unknown AI task: ${taskName}`);
      }

      setData(result);
      setLoading(false);
      return result;
    } catch (err) {
      const mapped = mapErrorMessage(err);
      setError(mapped);
      setLoading(false);
      throw mapped;
    }
  }, []);

  return {
    executeTask,
    loading,
    error,
    data,
    reset: () => {
      setError(null);
      setData(null);
      setLoading(false);
    }
  };
};
