/**
 * AI Provider Interface
 * Standard abstraction for pluggable AI providers (Gemini, OpenAI, Anthropic, Local)
 */
class AIProviderInterface {
  async generateText(prompt, systemInstruction = "") {
    throw new Error("generateText not implemented");
  }

  async summarize(messages = []) {
    throw new Error("summarize not implemented");
  }

  async rewrite(text, style = "professional") {
    throw new Error("rewrite not implemented");
  }

  async generateSmartReplies(messageText, recentContext = []) {
    throw new Error("generateSmartReplies not implemented");
  }

  async generateRAGAnswer(query, groundedChunks = []) {
    throw new Error("generateRAGAnswer not implemented");
  }

  async embedText(text) {
    throw new Error("embedText not implemented");
  }
}

module.exports = AIProviderInterface;
