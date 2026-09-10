const { describe, it, before } = require("node:test");
const assert = require("node:assert");

const BACKEND_URL = "http://localhost:8000";

describe("✨ AI Smart Replies & Suggestions Verification Suite", () => {
  let token;

  before(async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "gulshan.ai@flashchat.local", name: "Gulshan AI Tester" }),
    });
    const data = await res.json();
    token = data.data?.token || data.token;
    assert.ok(token, "Must obtain auth token");
  });

  it("Generates 'Sure, I'll send it shortly.' suggestions for document/file requests", async () => {
    const res = await fetch(`${BACKEND_URL}/api/chat/ai/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageText: "Can you please send me the latest quarterly report file?",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data?.suggestions, "Response must contain suggestions array");
    assert.ok(Array.isArray(body.data.suggestions), "suggestions must be an array");
    assert.ok(body.data.suggestions.length >= 2, "Must return at least 2 suggestions");
    
    // Verifies contextually relevant replies for sending files/documents
    const isRelevant = body.data.suggestions.some((s) => {
      const lower = s.toLowerCase();
      return lower.includes("send") || lower.includes("shortly") || lower.includes("email") || lower.includes("check");
    });
    assert.ok(isRelevant, "Must suggest relevant replies for sending/checking");
  });

  it("Generates availability suggestions when asked about meeting or call", async () => {
    const res = await fetch(`${BACKEND_URL}/api/chat/ai/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageText: "Are you free for a quick call?",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data?.suggestions));
    const hasFree = body.data.suggestions.some((s) =>
      s.toLowerCase().includes("free") || s.toLowerCase().includes("call")
    );
    assert.ok(hasFree, "Must provide context-aware availability suggestions");
  });

  it("Generates conversational suggestions for general questions", async () => {
    const res = await fetch(`${BACKEND_URL}/api/chat/ai/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageText: "What do you think about the new UI design?",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data?.suggestions));
    assert.ok(body.data.suggestions.length > 0);
  });
});
