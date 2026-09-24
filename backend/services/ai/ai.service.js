const GeminiProvider = require("./providers/geminiProvider");
const LocalProvider = require("./providers/localProvider");
const { searchKnowledgeBase } = require("./ai.rag");
const { sanitizePrompt, estimateTokenCount } = require("./ai.guardrails");
const AIUsage = require("../../models/AIUsage");

class AIService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.primaryProvider = this.geminiApiKey
      ? new GeminiProvider(this.geminiApiKey)
      : new LocalProvider();
    this.localProvider = new LocalProvider();
    this.cache = new Map();
  }

  getProvider(providerName) {
    if (providerName === "local") return this.localProvider;
    return this.primaryProvider;
  }

  async trackUsage(userId, orgId, feature, prompt, completion, durationMs) {
    try {
      const promptTokens = estimateTokenCount(prompt);
      const completionTokens = estimateTokenCount(completion);
      const totalTokens = promptTokens + completionTokens;
      // ~$0.0001 per 1k tokens estimate
      const costEstimateUSD = (totalTokens / 1000) * 0.0001;

      await AIUsage.create({
        user: userId,
        organization: orgId || null,
        feature,
        provider: this.geminiApiKey ? "gemini" : "local",
        model: this.geminiApiKey ? "gemini-flash" : "heuristic-rules",
        promptTokens,
        completionTokens,
        totalTokens,
        costEstimateUSD,
        durationMs,
      });
    } catch (e) {
      // Non-blocking error
      console.warn("[AIService] Usage tracking error:", e.message);
    }
  }

  async chat(userMessage, chatHistory = [], userId = null, orgId = null) {
    const startTime = Date.now();
    const cleanMessage = sanitizePrompt(userMessage);

    // If organization provided and business mode RAG is enabled, query knowledge base
    let groundedChunks = [];
    if (orgId) {
      try {
        const queryEmbedding = await this.primaryProvider.embedText(cleanMessage);
        groundedChunks = await searchKnowledgeBase(orgId, queryEmbedding, 3);
      } catch (e) {
        console.warn("[AIService] RAG retrieval error:", e.message);
      }
    }

    let answer;
    if (groundedChunks.length > 0) {
      answer = await this.primaryProvider.generateRAGAnswer(cleanMessage, groundedChunks);
    } else {
      answer = await this.primaryProvider.generateText(cleanMessage);
    }

    if (userId) {
      this.trackUsage(userId, orgId, "chat_assistant", cleanMessage, answer, Date.now() - startTime);
    }

    return answer;
  }

  async summarize(messages = [], userId = null, orgId = null) {
    const startTime = Date.now();
    const summary = await this.primaryProvider.summarize(messages);
    if (userId) {
      this.trackUsage(userId, orgId, "summarize", `[${messages.length} messages]`, summary, Date.now() - startTime);
    }
    return summary;
  }

  async rewrite(text, style = "professional", userId = null, orgId = null) {
    const startTime = Date.now();
    const clean = sanitizePrompt(text);
    const rewritten = await this.primaryProvider.rewrite(clean, style);
    if (userId) {
      this.trackUsage(userId, orgId, "rewrite", clean, rewritten, Date.now() - startTime);
    }
    return rewritten;
  }

  async smartReplies(messageText, recentContext = [], userId = null, orgId = null) {
    const startTime = Date.now();
    const clean = sanitizePrompt(messageText);
    const suggestions = await this.primaryProvider.generateSmartReplies(clean, recentContext);
    if (userId) {
      this.trackUsage(userId, orgId, "smart_reply", clean, JSON.stringify(suggestions), Date.now() - startTime);
    }
    return suggestions;
  }

  async groundQuery(query, orgId, userId = null) {
    const startTime = Date.now();
    const clean = sanitizePrompt(query);
    const queryEmbedding = await this.primaryProvider.embedText(clean);
    const chunks = await searchKnowledgeBase(orgId, queryEmbedding, 4);

    if (!chunks.length) {
      return {
        answer: "I do not have enough approved information in the knowledge base to answer this question.",
        sources: [],
      };
    }

    const answer = await this.primaryProvider.generateRAGAnswer(clean, chunks);
    if (userId) {
      this.trackUsage(userId, orgId, "rag_query", clean, answer, Date.now() - startTime);
    }

    return {
      answer,
      sources: chunks.map((c) => ({
        documentTitle: c.documentTitle,
        relevanceScore: Math.round(c.score * 100),
      })),
    };
  }
}

// Singleton instance
const aiService = new AIService();
module.exports = aiService;
