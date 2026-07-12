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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: formattedContents,
            systemInstruction: {
              parts: [{ text: "You are Flash AI, a helpful, friendly, and intelligent AI assistant integrated into Flash Chat. Keep your responses relatively concise, engaging, and formatted nicely with emojis." }]
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          return textResponse.trim();
        }
      }
      console.warn("Gemini API call failed or returned empty response. Falling back to local responder.");
    } catch (err) {
      console.error("Error calling Gemini API:", err);
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

module.exports = {
  generateAIResponse
};
