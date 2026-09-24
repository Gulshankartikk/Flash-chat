// Use stable aliases first so the key never breaks on model deprecation.
// 'gemini-flash-latest' always routes to the best available flash model.
const SUPPORTED_MODELS = [
  "gemini-flash-latest",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

let warnedInvalidKey = false;

// Simple in-memory response cache to avoid duplicate API calls.
// Key: hash of the prompt text. TTL: 5 minutes.
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(cacheKey) {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function setCache(cacheKey, value) {
  // Keep cache small — evict oldest entries when over 50 items
  if (responseCache.size >= 50) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(cacheKey, { value, ts: Date.now() });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGeminiAPI(apiKey, payload) {
  if (
    !apiKey ||
    typeof apiKey !== "string" ||
    apiKey.trim().length < 15 ||
    apiKey.includes("your_google_gemini_api_key") ||
    apiKey.includes("replace_") ||
    warnedInvalidKey
  ) {
    return null;
  }

  // Build a simple cache key from the last user message text
  const promptText = payload?.contents
    ?.flatMap((c) => c.parts ?? [])
    .map((p) => p.text ?? "")
    .join("|") ?? "";
  const cacheKey = promptText.substring(0, 200);

  const cached = getCached(cacheKey);
  if (cached) {
    console.log("[Gemini] Serving response from cache.");
    return cached;
  }

  for (const model of SUPPORTED_MODELS) {
    // Retry up to 2 times on 503/429 with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const result = textResponse.trim();
            setCache(cacheKey, result);
            return result;
          }
          break; // Empty response, try next model
        } else if (response.status === 503 || response.status === 429) {
          const waitMs = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
          console.warn(`[Gemini] Model ${model} overloaded (${response.status}), retrying in ${waitMs / 1000}s... (attempt ${attempt + 1}/3)`);
          await sleep(waitMs);
          // On last attempt for this model, fall through to next model
          if (attempt === 2) break;
        } else if (response.status === 401 || response.status === 403) {
          if (!warnedInvalidKey) {
            console.warn("[Gemini] API authentication failed (HTTP 401/403). Falling back to local mode.");
            warnedInvalidKey = true;
          }
          return null; // Auth failure — no point retrying any model
        } else if (response.status === 404) {
          const errText = await response.text();
          console.warn(`[Gemini] Model ${model} not found (404), trying next. ${errText.substring(0, 80)}`);
          break; // Try next model immediately
        } else {
          const errText = await response.text();
          console.warn(`[Gemini] Model ${model} returned HTTP ${response.status}: ${errText.substring(0, 100)}`);
          break;
        }
      } catch (err) {
        if (attempt < 2) {
          const waitMs = Math.pow(2, attempt) * 1000;
          console.warn(`[Gemini] Error contacting model ${model}: ${err.message}. Retrying in ${waitMs / 1000}s...`);
          await sleep(waitMs);
        } else {
          console.warn(`[Gemini] Error contacting model ${model}: ${err.message}`);
        }
      }
    }
  }
  return null;
}


/**
 * Generates a response from the AI Chat Assistant.
 * If GEMINI_API_KEY is configured in the environment, it uses the Gemini API.
 * Otherwise, it falls back to a smart local conversational engine.
 * 
 * @param {string} userMessage - The message sent by the user.
 * @param {Array} chatHistory - Recent messages in the conversation for context.
 * @returns {Promise<string>} The AI's response.
 */
async function generateAIResponse(userMessage, chatHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      // Build simple context from recent chat history
      const formattedContents = [];
      
      // Limit history to last 6 messages to keep it lightweight
      const recentHistory = chatHistory.slice(-6);
      recentHistory.forEach(msg => {
        const isModel = msg.sender?.isAIBot || msg.sender === "ai";
        formattedContents.push({
          role: isModel ? "model" : "user",
          parts: [{ text: msg.content || "" }]
        });
      });

      // Add the new user message
      formattedContents.push({
        role: "user",
        parts: [{ text: userMessage }]
      });

      const textResponse = await callGeminiAPI(apiKey, {
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: "You are Flash AI, a helpful, friendly, and intelligent AI assistant integrated into Flash Chat. Keep your responses relatively concise, engaging, and formatted nicely with emojis." }]
        }
      });

      if (textResponse) {
        return textResponse;
      }
      if (!warnedInvalidKey) {
        console.warn("Gemini API call failed or returned empty response. Falling back to local responder.");
        warnedInvalidKey = true;
      }
    } catch (err) {
      if (!warnedInvalidKey) {
        console.error("Error calling Gemini API:", err.message);
        warnedInvalidKey = true;
      }
    }
  }

  // Smart Offline / Local Fallback
  return getLocalResponse(userMessage);
}

/**
 * Simple local rule-based response generator for offline/fallback mode.
 */
function getLocalResponse(message) {
  const cleanMsg = message.toLowerCase().trim();

  if (cleanMsg.match(/\b(hi|hello|hey|hola|greetings)\b/)) {
    return "👋 Hello! I am **Flash AI**, your virtual assistant. How can I help you today? \n\n*(Note: I am running in local fallback mode. To unlock my full AI capabilities, please add a `GEMINI_API_KEY` to the backend `.env` file!)*";
  }

  if (cleanMsg.match(/\b(help|what can you do|features)\b/)) {
    return "🤖 Here are some things I can do and features you can explore in **Flash Chat**:\n\n" +
           "1. **💬 Chat Features**: Try sending messages, replying to them, reacting with emojis (👍❤️😂), or editing/deleting messages!\n" +
           "2. **🔐 End-to-End Encryption**: All your private chats are secured client-side using AES-GCM encryption.\n" +
           "3. **☁️ Backup & Restore**: Go to **Settings** to export your chat history as a JSON file and restore it later.\n" +
           "4. **📞 Calling**: Start a high-quality audio/video call or share your screen with other users.\n\n" +
           "Feel free to ask me questions about any of these!";
  }

  if (cleanMsg.match(/\b(encrypt|security|e2ee|secure|private)\b/)) {
    return "🔐 **End-to-End Encryption (E2EE)** in Flash Chat secures your conversations using the browser's native Web Crypto API. \n\nMessages are encrypted with an **AES-GCM** key derived from the conversation ID before they leave your device. The server only sees encrypted ciphertext, meaning only you and the recipient can read them!";
  }

  if (cleanMsg.match(/\b(backup|restore|export|import)\b/)) {
    return "☁️ **Chat Backup & Restore**:\n\n" +
           "- **Export**: Go to **Settings**, click **Export Backup**, and download your complete chat history as a JSON file.\n" +
           "- **Restore**: Under **Settings**, upload your exported backup file to restore your conversations and messages seamlessly.";
  }

  if (cleanMsg.match(/\b(joke|laugh|funny)\b/)) {
    const jokes = [
      "Why do programmers wear glasses? Because they can't C#! 🤓",
      "How many programmers does it take to change a light bulb? None, that's a hardware problem! 💡",
      "There are 10 types of people in the world: those who understand binary, and those who don't. 🔢",
      "Why did the database administrator leave his wife? She had one-to-many relationships! 🖥️"
    ];
    return "Haha, here's one for you:\n\n" + jokes[Math.floor(Math.random() * jokes.length)];
  }

  // Default fallback
  return `🤖 I'm here! You said: *"${message}"*\n\nSince I'm currently running in **local offline mode**, I have limited understanding. To enable my advanced reasoning, please add a \`GEMINI_API_KEY\` to your backend \`.env\` file. How else can I assist you?`;
}

// In-memory rate limiting for AI endpoint (max 20 calls per min per user)
const userRateLimits = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const userTimestamps = userRateLimits.get(String(userId)) || [];
  const validTimestamps = userTimestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= 20) {
    return false;
  }

  validTimestamps.push(now);
  userRateLimits.set(String(userId), validTimestamps);
  return true;
}

/**
 * Summarizes recent conversation history using Gemini AI.
 */
async function summarizeChat(messages = [], userId) {
  if (userId && !checkRateLimit(userId)) {
    throw new Error("AI rate limit exceeded. Please wait a minute before requesting another summary.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const chatText = messages
    .slice(-30)
    .map((m) => `${m.sender?.username || "User"}: ${m.content || ""}`)
    .join("\n");

  if (apiKey) {
    try {
      const summary = await callGeminiAPI(apiKey, {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Summarize the following chat conversation concisely with bullet points and action items if any:\n\n${chatText}`,
              },
            ],
          },
        ],
      });

      if (summary) return summary.trim();
    } catch (err) {
      console.error("Gemini summarize error:", err);
    }
  }

  // Fallback summary
  return `📌 **Conversation Summary** (${messages.length} messages analyzed):\n- Recent discussion involved ${messages.length} messages.\n- Key participants: ${[...new Set(messages.map((m) => m.sender?.username || "User"))].join(", ")}.`;
}

/**
 * Rewrites or translates a drafted message into a target style/language.
 */
async function rewriteMessage(text, style = "professional", userId) {
  if (userId && !checkRateLimit(userId)) {
    throw new Error("AI rate limit exceeded. Please wait a minute.");
  }

  const cleanText = (text || "").trim();
  if (!cleanText) return "";

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      let promptInstruction = `Rewrite the following draft text to be ${style}.`;
      if (style === "improve") {
        promptInstruction = "Improve and polish the following draft text to make it clearer, more fluent, and engaging.";
      } else if (style === "shorten") {
        promptInstruction = "Make the following draft text concise, brief, and to the point without losing meaning.";
      } else if (style === "expand") {
        promptInstruction = "Expand the following draft text into a well-crafted, polite, and detailed message.";
      } else if (style === "professional") {
        promptInstruction = "Rewrite the following draft text to be professional, courteous, and business-appropriate.";
      } else if (style === "casual") {
        promptInstruction = "Rewrite the following draft text to be casual, relaxed, warm, and friendly.";
      } else if (style === "grammar") {
        promptInstruction = "Fix all grammar, punctuation, spelling, and capitalization errors in the following text. Do not change the intended tone or meaning.";
      } else if (style === "translate") {
        promptInstruction = "Translate the following text into fluent, natural English.";
      }

      const prompt = `${promptInstruction} Return ONLY the rewritten text without quotation marks or explanations:\n\n"${cleanText}"`;
      const result = await callGeminiAPI(apiKey, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      if (result) return result.trim();
    } catch (err) {
      console.error("Gemini rewrite error:", err);
    }
  }

  // Smart Offline / Local Fallback Rules
  return getLocalRewrite(cleanText, style);
}

function getLocalRewrite(text, style) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Common Hindi/Hinglish translation dictionary for offline demo/fallback
  if (style === "translate") {
    if (lower.includes("meeting kal kitne baje")) return "What time is the meeting tomorrow?";
    if (lower.includes("aap kaise ho") || lower.includes("kaise ho")) return "How are you?";
    if (lower.includes("theek hu") || lower.includes("main theek")) return "I am doing well, thank you.";
    if (lower.includes("kal milte")) return "See you tomorrow.";
    if (lower.includes("dhanyawad") || lower.includes("shukriya")) return "Thank you very much.";
    return `[Translated]: ${trimmed}`;
  }

  if (style === "grammar" || style === "improve") {
    // Capitalize first character and ensure punctuation
    let fixed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!/[.!?]$/.test(fixed)) {
      fixed += ".";
    }
    return fixed;
  }

  if (style === "professional") {
    let fixed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!/[.!?]$/.test(fixed)) fixed += ".";
    return `Dear colleague, ${fixed.toLowerCase().startsWith("please") ? fixed : `please note: ${fixed}`}`;
  }

  if (style === "casual") {
    return `Hey! ${trimmed} 😊`;
  }

  if (style === "shorten") {
    return trimmed.replace(/\b(can you please|could you possibly|at this point in time|just wanted to let you know that)\b/gi, "").trim();
  }

  if (style === "expand") {
    return `Hi there, just following up regarding this: ${trimmed}. Looking forward to your thoughts!`;
  }

  return trimmed;
}

/**
 * Generates quick smart reply suggestions based on the incoming message.
 */
async function generateSmartReplies(messageText, recentContext = [], userId) {
  if (userId && !checkRateLimit(userId)) {
    throw new Error("AI rate limit exceeded. Please wait a minute.");
  }

  const text = (messageText || "").trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && text) {
    try {
      const prompt = `You are an AI assistant generating quick smart reply suggestions for a WhatsApp-style chat application.
Based on the incoming message below, provide 2 to 3 natural, concise, and helpful replies that the user can tap to send.
Incoming message: "${text}"

Rules:
1. Provide between 2 and 3 short replies (under 10 words each).
2. Format the output STRICTLY as a JSON array of strings, for example:
["Sure, I'll send it shortly.", "I'll check and let you know."]
Do not include markdown codeblocks, commentary, or quotes outside the JSON.`;

      const result = await callGeminiAPI(apiKey, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      if (result) {
        const cleaned = result.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 3).map((s) => String(s).trim());
        }
      }
    } catch (err) {
      console.warn("Gemini smart replies error, falling back to local:", err.message);
    }
  }

  return getLocalSmartReplies(text);
}

function getLocalSmartReplies(message) {
  const clean = (message || "").toLowerCase().trim();

  if (clean.match(/\b(send|share|give|upload|link|document|doc|pdf|file|report|attachment|photo|pic|image|code)\b/)) {
    return [
      "Sure, I'll send it shortly.",
      "I'll check and let you know.",
      "Will share it in a bit!",
    ];
  }

  if (clean.match(/\b(free|available|call|meet|talk|catch up|zoom|online|voice|video)\b/)) {
    return [
      "Yes, I'm free right now!",
      "A bit busy, can we talk in 15 mins?",
      "Let's jump on a quick call.",
    ];
  }

  if (clean.match(/\b(where|when|what time|eta|how long|status)\b/)) {
    return [
      "On my way now!",
      "I'll check and let you know.",
      "In about 10 minutes.",
    ];
  }

  if (clean.match(/\b(how are you|how's it going|how are things|wassup|what's up)\b/)) {
    return [
      "I'm doing well, thanks! How about you?",
      "All good here! Hope you're doing well.",
      "Pretty good, just getting some work done.",
    ];
  }

  if (clean.match(/\b(hi|hello|hey|hola|morning|afternoon|evening)\b/)) {
    return [
      "Hey! How's it going?",
      "Hello! How can I help you?",
      "Hey there! Good to hear from you.",
    ];
  }

  if (clean.match(/\b(thanks|thank you|thx|appreciate it)\b/)) {
    return [
      "You're welcome!",
      "Anytime! Glad to help.",
      "No problem at all!",
    ];
  }

  if (clean.match(/\b(ok|okay|got it|sounds good|cool|done|perfect|great)\b/)) {
    return [
      "Great, talk soon!",
      "Sounds like a plan!",
      "Awesome! 👍",
    ];
  }

  if (clean.includes("?")) {
    return [
      "Sure, let me check on that.",
      "I'll find out and let you know.",
      "Sounds good to me!",
    ];
  }

  return [
    "Sure, I'll send it shortly.",
    "I'll check and let you know.",
    "Sounds good!",
  ];
}

module.exports = {
  generateAIResponse,
  summarizeChat,
  rewriteMessage,
  generateSmartReplies,
  checkRateLimit,
};


