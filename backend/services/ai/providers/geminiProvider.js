const AIProviderInterface = require("../ai.interface");
const LocalProvider = require("./localProvider");

const SUPPORTED_MODELS = [
  "gemini-flash-latest",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

class GeminiProvider extends AIProviderInterface {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.localFallback = new LocalProvider();
  }

  async callGemini(payload) {
    if (!this.apiKey || this.apiKey.trim().length < 10) return null;

    for (const model of SUPPORTED_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20000),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text.trim();
        }
      } catch (err) {
        // try next model
      }
    }
    return null;
  }

  async generateText(prompt, systemInstruction = "") {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await this.callGemini(payload);
    return res || this.localFallback.generateText(prompt, systemInstruction);
  }

  async summarize(messages = []) {
    const chatText = messages
      .slice(-30)
      .map((m) => `${m.sender?.username || "User"}: ${m.content || ""}`)
      .join("\n");

    const prompt = `Summarize the following chat conversation concisely with bullet points and action items if any:\n\n${chatText}`;
    const res = await this.callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return res || this.localFallback.summarize(messages);
  }

  async rewrite(text, style = "professional") {
    const prompt = `Rewrite the following text to be ${style}. Return ONLY the rewritten text without markdown fences or quotes:\n\n"${text}"`;
    const res = await this.callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return res || this.localFallback.rewrite(text, style);
  }

  async generateSmartReplies(messageText, recentContext = []) {
    const prompt = `Generate 2 to 3 natural, concise, helpful reply suggestions (under 10 words each) for this message in a chat app.
Incoming message: "${messageText}"
Return STRICTLY a JSON array of strings, e.g. ["Sure, I'll send it.", "Let me check."]`;

    const res = await this.callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    if (res) {
      try {
        const cleaned = res.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 3);
        }
      } catch (e) {
        // fall back
      }
    }

    return this.localFallback.generateSmartReplies(messageText, recentContext);
  }

  async generateRAGAnswer(query, groundedChunks = []) {
    if (!groundedChunks.length) {
      return "⚠️ I do not have enough approved information in the knowledge base to answer this question.";
    }

    const contextText = groundedChunks
      .map((c, idx) => `[Source ${idx + 1}]: ${c.text}`)
      .join("\n\n");

    const prompt = `You are a helpful and strictly grounded customer support assistant.
Answer the user's question ONLY using the approved context below. If the answer cannot be determined strictly from the provided context, state: "I do not have enough information in the organization knowledge base to answer this question."

Approved Knowledge Context:
${contextText}

User Question: ${query}

Grounded Answer:`;

    const res = await this.callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return res || this.localFallback.generateRAGAnswer(query, groundedChunks);
  }

  async embedText(text) {
    // Try Gemini embedding if available, otherwise local vector
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text: (text || "").slice(0, 2000) }] },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const values = data.embedding?.values;
        if (Array.isArray(values) && values.length > 0) {
          // Normalize to top 64 dims for lightweight storage
          return values.slice(0, 64);
        }
      }
    } catch (e) {
      // fallback to local embedding
    }
    return this.localFallback.embedText(text);
  }
}

module.exports = GeminiProvider;
