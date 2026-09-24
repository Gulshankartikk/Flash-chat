const AIProviderInterface = require("../ai.interface");

class LocalProvider extends AIProviderInterface {
  async generateText(prompt, systemInstruction = "") {
    const cleanMsg = (prompt || "").toLowerCase().trim();

    if (cleanMsg.match(/\b(hi|hello|hey|hola|greetings)\b/)) {
      return "👋 Hello! I am **Flash AI**, your virtual assistant. How can I help you today?";
    }

    if (cleanMsg.match(/\b(help|what can you do|features)\b/)) {
      return (
        "🤖 **Flash Chat Features**:\n\n" +
        "1. **💬 Real-Time Chat**: Direct & group messaging, reactions, edits, replies, and pinned banners.\n" +
        "2. **🏢 Business Mode**: Support inboxes, ticket assignment, and team CRM.\n" +
        "3. **🔐 End-to-End Encryption**: AES-256-GCM browser encryption.\n" +
        "4. **📞 Calling**: Crystal-clear WebRTC voice & video calls.\n" +
        "5. **🧠 Knowledge Base (RAG)**: Ask questions grounded in uploaded company documentation."
      );
    }

    if (cleanMsg.match(/\b(encrypt|security|e2ee|secure|private)\b/)) {
      return "🔐 **End-to-End Encryption (E2EE)** in Flash Chat uses browser Web Crypto (ECDH Curve P-256 + AES-GCM 256-bit). Only sender and receiver can decrypt the contents.";
    }

    return `🤖 Flash AI (Local Mode): I received your message: "${prompt}". Configure \`GEMINI_API_KEY\` or an OpenAI key in \`.env\` for full multi-turn conversational AI!`;
  }

  async summarize(messages = []) {
    if (!messages.length) return "📌 No messages to summarize.";
    const senders = [...new Set(messages.map((m) => m.sender?.username || "Participant"))];
    return (
      `📌 **Thread Summary** (${messages.length} messages analyzed):\n` +
      `- **Participants**: ${senders.join(", ")}\n` +
      `- **Discussion**: Covers recent project updates, inquiries, and coordination items.\n` +
      `- **Key Takeaway**: Thread active with key status updates shared.`
    );
  }

  async rewrite(text, style = "professional") {
    const trimmed = (text || "").trim();
    if (!trimmed) return "";

    let capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!/[.!?]$/.test(capitalized)) capitalized += ".";

    switch (style) {
      case "professional":
        return `Dear colleague, ${capitalized.toLowerCase().startsWith("please") ? capitalized : `please note: ${capitalized}`}`;
      case "casual":
        return `Hey! ${trimmed} 😊`;
      case "shorten":
        return trimmed.replace(/\b(can you please|could you possibly|just wanted to let you know that)\b/gi, "").trim();
      case "expand":
        return `Hi there, following up on our discussion regarding this: ${trimmed}. Looking forward to your thoughts!`;
      case "grammar":
      case "improve":
        return capitalized;
      case "translate":
        return `[English]: ${capitalized}`;
      default:
        return capitalized;
    }
  }

  async generateSmartReplies(messageText, recentContext = []) {
    const clean = (messageText || "").toLowerCase().trim();

    if (clean.match(/\b(send|share|give|upload|link|document|doc|pdf|file|report|attachment)\b/)) {
      return ["Sure, I'll send it shortly.", "I'll check and let you know.", "Will share it in a bit!"];
    }
    if (clean.match(/\b(free|available|call|meet|talk|catch up|zoom|online)\b/)) {
      return ["Yes, I'm free right now!", "A bit busy, can we talk in 15 mins?", "Let's jump on a quick call."];
    }
    if (clean.match(/\b(where|when|what time|eta|how long|status)\b/)) {
      return ["On my way now!", "I'll check and let you know.", "In about 10 minutes."];
    }
    if (clean.match(/\b(thanks|thank you|thx)\b/)) {
      return ["You're welcome!", "Anytime! Glad to help.", "No problem at all!"];
    }
    return ["Sure, I'll send it shortly.", "I'll check and let you know.", "Sounds good!"];
  }

  async generateRAGAnswer(query, groundedChunks = []) {
    if (!groundedChunks.length) {
      return "⚠️ I do not have enough approved information in the knowledge base to answer this question.";
    }
    const contextSnippet = groundedChunks.map((c) => c.text).join(" ");
    return (
      `📚 **According to the Organization Knowledge Base**:\n\n` +
      `${contextSnippet.slice(0, 300)}...\n\n` +
      `*(Source: Approved internal documentation)*`
    );
  }

  async embedText(text) {
    // Generate deterministic 64-dimensional semantic pseudo-vector for local chunk matching
    const vec = new Array(64).fill(0);
    const words = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
    for (const w of words) {
      if (!w) continue;
      for (let i = 0; i < w.length; i++) {
        const idx = (w.charCodeAt(i) * (i + 1)) % 64;
        vec[idx] += 1;
      }
    }
    // Normalize vector
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => Number((v / norm).toFixed(4)));
  }
}

module.exports = LocalProvider;
