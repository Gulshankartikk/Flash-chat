const crypto = require('crypto');
const mongoose = require('mongoose');
const { getGeminiModel, isConfigured, isMockMode, config } = require('../config/gemini');
const { PROMPT_TEMPLATES } = require('./ai/prompts');
const AiUsage = require('../models/AiUsage');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class AiService {
  constructor() {
    this.maxInputChars = config.AI_MAX_INPUT_CHARS || 8000;
    this.dailyLimit = config.AI_DAILY_LIMIT || 50;
  }

  /**
   * Helper: Truncate input string safely
   */
  truncateInput(text, limit = this.maxInputChars) {
    if (!text || typeof text !== 'string') return '';
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '... [truncated]';
  }

  /**
   * Helper: Strip obvious PII/secrets (emails, phone numbers) when summarizing or generating public output
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, '[email]')
      .replace(/(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g, '[phone]');
  }

  /**
   * Today date string format "YYYY-MM-DD"
   */
  getTodayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  /**
   * Check user rate limit & daily quota
   * @param {string} userId
   */
  async checkQuotaAndRateLimit(userId) {
    const today = this.getTodayDateString();

    // 1. Check Redis per-minute rate limit (20 req/min)
    if (redisClient && redisClient.status === 'ready') {
      try {
        const rateKey = `ai_rate:${userId}`;
        const currentRate = await redisClient.incr(rateKey);
        if (currentRate === 1) {
          await redisClient.expire(rateKey, 60);
        }
        if (currentRate > 20) {
          const ttl = await redisClient.ttl(rateKey);
          const error = new Error(`AI rate limit exceeded. Please wait ${ttl > 0 ? ttl : 60} seconds.`);
          error.code = 'AI_RATE_LIMITED';
          error.statusCode = 429;
          throw error;
        }
      } catch (err) {
        if (err.code === 'AI_RATE_LIMITED') throw err;
        logger.warn({ err: err.message }, 'Redis rate check error');
      }
    }

    // 2. Check Daily Quota in MongoDB / Redis
    if (!userId || !mongoose.isValidObjectId(userId) || mongoose.connection.readyState !== 1) {
      return { allowed: true, currentUsage: 0, limit: this.dailyLimit };
    }

    let usage = await AiUsage.findOne({ user: userId, date: today });
    if (!usage) {
      usage = await AiUsage.create({ user: userId, date: today, requestCount: 0, tokenCount: 0 });
    }

    if (usage.requestCount >= this.dailyLimit) {
      const error = new Error(`Daily AI limit reached (${this.dailyLimit} requests/day). Resets at midnight UTC.`);
      error.code = 'AI_RATE_LIMITED';
      error.statusCode = 429;
      throw error;
    }

    return { allowed: true, currentUsage: usage.requestCount, limit: this.dailyLimit };
  }

  /**
   * Record usage for a user
   */
  async recordUsage(userId, tokenEstimate = 50) {
    if (!userId || !mongoose.isValidObjectId(userId) || mongoose.connection.readyState !== 1) {
      return;
    }
    const today = this.getTodayDateString();
    try {
      await AiUsage.findOneAndUpdate(
        { user: userId, date: today },
        {
          $inc: { requestCount: 1, tokenCount: tokenEstimate },
          $set: { lastRequestAt: new Date() }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to record AI usage metrics');
    }
  }

  /**
   * Get user daily usage statistics
   */
  async getDailyUsage(userId) {
    const today = this.getTodayDateString();
    let usage = null;
    if (userId && mongoose.isValidObjectId(userId) && mongoose.connection.readyState === 1) {
      usage = await AiUsage.findOne({ user: userId, date: today });
    }
    const used = usage ? usage.requestCount : 0;
    const tokens = usage ? usage.tokenCount : 0;
    const remaining = Math.max(0, this.dailyLimit - used);

    // Calculate reset time at next midnight UTC
    const now = new Date();
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

    return {
      used,
      tokens,
      limit: this.dailyLimit,
      remaining,
      percent: Math.min(100, Math.round((used / this.dailyLimit) * 100)),
      resetAt: resetDate,
      resetsAt: resetDate
    };
  }

  /**
   * Helper: Parse JSON safely from model response
   */
  parseJsonOutput(rawText, fallback = null) {
    if (!rawText || typeof rawText !== 'string') return fallback;
    let cleaned = rawText.trim();
    // Strip markdown code fences if model returned them
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Attempt to extract json object or array
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (innerErr) {
          logger.warn({ raw: cleaned }, 'Failed secondary JSON parse on AI output');
        }
      }
      return fallback;
    }
  }

  /**
   * Mock generation handler for offline / development without API key
   */
  getMockResponse(task, input) {
    switch (task) {
      case 'smartReplies':
        return ['Sounds great!', 'I agree 👍', 'Let me check on that'];
      case 'summarizeChat':
        return `### ⚡ Chat Summary (Mock Mode)\n\n**Key Takeaways:**\n- Discussions were held regarding current updates.\n- Seamless progress across all project components.\n\n**Decisions:**\n- Agreed to proceed with current architecture.\n\n**Action Items:**\n- Verify tests and integration checklists.`;
      case 'translate':
        return `[Translated (${input.targetLang || 'English'})]: ${input.text || ''}`;
      case 'rewrite':
        return `[${input.tone || 'friendly'} style]: ${input.text || ''}`;
      case 'captionGenerator':
        return {
          caption: 'Capturing moments that truly matter ✨ Keep pushing boundaries! 🚀',
          hashtags: ['#FlashChat', '#Inspiration', '#Community', '#Tech', '#Moments']
        };
      case 'hashtagSuggestions':
        return ['#FlashChat', '#Explore', '#Trending', '#Community', '#Viral'];
      case 'commentReplySuggestions':
        return ['Thank you so much! ❤️', 'Appreciate your support! 🙌', 'Glad you enjoyed it! 🚀'];
      case 'moderationCheck':
        return { flagged: false, categories: [], reason: '' };
      case 'summarizeItem':
        return `**Summary:** This saved item covers essential concepts, notes, and references for future retrieval.`;
      case 'autoTag':
        return ['notes', 'important', 'flash-chat', 'reference'];
      case 'answerFromPocket':
        return `Based on your saved Pocket items [Item #1], here is a summary answer to your question: All relevant notes point to successful completion of project milestones.`;
      case 'imageDescribe':
        return 'The image showcases a vibrant and modern visual layout with balanced composition.';
      case 'askAi':
      default:
        return `Hello! Flash AI is currently operating in offline/mock mode because \`GEMINI_API_KEY\` is not configured. Set your Google Gemini API key in \`.env\` to enable live generative AI intelligence.`;
    }
  }

  /**
   * Generic generation method for all one-shot AI tasks
   * @param {Object} params
   * @param {string} params.task
   * @param {Object} params.input
   * @param {Object} [params.options]
   * @param {string} [params.userId]
   */
  async generate({ task, input, options = {}, userId }) {
    if (userId) {
      await this.checkQuotaAndRateLimit(userId);
    }

    const templateFn = PROMPT_TEMPLATES[task];
    if (!templateFn) {
      throw new Error(`Unknown AI task template: ${task}`);
    }

    // Deterministic caching for tasks like translate, hashtags, summarizeItem
    const isDeterministic = ['translate', 'hashtagSuggestions', 'summarizeItem', 'autoTag'].includes(task);
    const cacheKey = isDeterministic && redisClient && redisClient.status === 'ready'
      ? `ai_cache:${crypto.createHash('sha256').update(task + JSON.stringify(input)).digest('hex')}`
      : null;

    if (cacheKey) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Redis cache read failed');
      }
    }

    // Mock Mode fallback
    if (isMockMode() || options.forceMock || this.forceMock) {
      const mockResult = this.getMockResponse(task, input);
      if (userId) await this.recordUsage(userId, 20);
      return mockResult;
    }

    const { systemPrompt, userPrompt } = templateFn(input);
    const model = getGeminiModel({
      modelType: options.modelType || 'flash',
      systemInstruction: systemPrompt,
      generationConfig: options.generationConfig
    });

    if (!model) {
      return this.getMockResponse(task, input);
    }

    // Call Gemini with 1 retry on 429/5xx and 8s timeout with guaranteed Promise.race
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let timeoutId = null;
      try {
        const controller = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
            reject(new Error('AI generation timed out after 8 seconds'));
          }, 8000);
        });

        const generatePromise = model.generateContent(
          {
            contents: [{ role: 'user', parts: [{ text: this.truncateInput(userPrompt) }] }]
          },
          { signal: controller.signal }
        );

        const result = await Promise.race([generatePromise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        const responseText = result.response.text();
        let parsedResult = responseText;

        // Tasks that expect strict JSON
        if (['smartReplies', 'captionGenerator', 'hashtagSuggestions', 'commentReplySuggestions', 'moderationCheck', 'autoTag'].includes(task)) {
          parsedResult = this.parseJsonOutput(responseText, this.getMockResponse(task, input));
        }

        if (userId) {
          const tokens = result.response.usageMetadata?.totalTokenCount || 50;
          await this.recordUsage(userId, tokens);
        }

        // Cache result if applicable
        if (cacheKey && parsedResult) {
          try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(parsedResult));
          } catch (cErr) {
            logger.warn({ err: cErr.message }, 'Failed to set Redis AI cache');
          }
        }

        return parsedResult;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        logger.warn({ attempt, err: err.message }, 'Gemini generation attempt error');
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 500)); // Backoff 500ms
        }
      }
    }

    logger.error({ err: lastError?.message }, 'Gemini generation failed after retries. Falling back to mock output.');
    return this.getMockResponse(task, input);
  }

  /**
   * Stream chat conversation with Gemini
   * @param {Object} params
   * @param {Array} params.history - previous conversation messages [{role, text, attachments}]
   * @param {string} params.message - user prompt
   * @param {Array} [params.attachments] - image attachments [{url, mimeType}]
   * @param {string} [params.systemPrompt]
   * @param {string} params.userId
   * @param {AbortSignal} [params.signal]
   * @returns {AsyncGenerator<{token: string, done: boolean}>}
   */
  async *chatStream({ history = [], message, attachments = [], systemPrompt, userId, signal }) {
    if (userId) {
      await this.checkQuotaAndRateLimit(userId);
    }

    // Mock Mode streaming generator
    if (isMockMode() || this.forceMock) {
      const mockText = `Hello! Flash AI is running in local demonstration mode because \`GEMINI_API_KEY\` is not configured.\n\nYou asked:\n> "${message}"\n\nOnce configured with your Gemini API key in \`server/.env\`, full generative intelligence with streaming, multimodal vision, and RAG search is automatically enabled!`;
      const words = mockText.split(' ');
      for (const word of words) {
        if (signal?.aborted) return;
        yield { token: word + ' ', done: false };
        await new Promise((r) => setTimeout(r, 40));
      }
      if (userId) await this.recordUsage(userId, 30);
      yield { token: '', done: true };
      return;
    }

    const defaultSystem = `You are Flash AI, the helpful, witty, and accurate AI assistant integrated across Flash Chat. Provide clear, beautifully formatted markdown answers with syntax-highlighted code blocks, tables, and bullet points.`;
    const model = getGeminiModel({
      modelType: 'flash',
      systemInstruction: systemPrompt || defaultSystem
    });

    if (!model) {
      yield { token: 'AI model is currently unavailable.', done: true };
      return;
    }

    // Format chat history
    const contents = [];
    for (const h of history) {
      const role = h.role === 'model' || h.role === 'assistant' ? 'model' : 'user';
      const parts = [];
      if (h.attachments && Array.isArray(h.attachments)) {
        for (const att of h.attachments) {
          if (att.base64 && att.mimeType) {
            parts.push({
              inlineData: {
                data: att.base64,
                mimeType: att.mimeType
              }
            });
          }
        }
      }
      parts.push({ text: this.truncateInput(h.text || '') });
      contents.push({ role, parts });
    }

    // Add current message parts
    const currentParts = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.base64 && att.mimeType) {
          currentParts.push({
            inlineData: {
              data: att.base64,
              mimeType: att.mimeType
            }
          });
        }
      }
    }
    currentParts.push({ text: this.truncateInput(message) });
    contents.push({ role: 'user', parts: currentParts });

    try {
      const resultStream = await model.generateContentStream({ contents });
      let fullTokensCount = 0;

      for await (const chunk of resultStream.stream) {
        if (signal?.aborted) break;
        const text = chunk.text();
        if (text) {
          fullTokensCount += Math.ceil(text.length / 4);
          yield { token: text, done: false };
        }
      }

      if (userId) {
        await this.recordUsage(userId, Math.max(fullTokensCount, 50));
      }
      yield { token: '', done: true };
    } catch (err) {
      logger.warn({ err: err.message }, 'Gemini stream generation failed, falling back to simulated stream');
      const fallbackText = `Hello! I received your message:\n\n> "${message}"\n\nI am Flash AI, your intelligent assistant on Flash Chat. I can help answer questions, summarize messages, draft social captions, analyze code, and assist with your daily productivity!`;
      const words = fallbackText.split(' ');
      for (const word of words) {
        if (signal?.aborted) return;
        yield { token: word + ' ', done: false };
        await new Promise((r) => setTimeout(r, 20));
      }
      if (userId) await this.recordUsage(userId, 30);
      yield { token: '', done: true };
    }
  }
}


module.exports = new AiService();
