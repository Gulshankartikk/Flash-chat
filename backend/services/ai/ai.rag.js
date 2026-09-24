const KnowledgeDocument = require("../../models/KnowledgeDocument");

/**
 * Splits raw document text into overlapping chunks
 */
function chunkDocument(text, chunkSize = 400, overlap = 50) {
  if (!text || typeof text !== "string") return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkText = words.slice(start, end).join(" ");

    chunks.push({
      chunkIndex,
      text: chunkText,
      tokenCount: end - start,
      embedding: [],
    });

    chunkIndex++;
    if (end >= words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Cosine similarity between two numerical vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !vecA.length || !vecB.length) return 0;
  const len = Math.min(vecA.length, vecB.length);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches across an organization's indexed knowledge documents
 */
async function searchKnowledgeBase(orgId, queryEmbedding, topK = 3, minScore = 0.25) {
  const documents = await KnowledgeDocument.find({
    organization: orgId,
    status: "ready",
  });

  const scoredChunks = [];

  for (const doc of documents) {
    for (const chunk of doc.chunks || []) {
      if (!chunk.embedding || !chunk.embedding.length) continue;
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minScore) {
        scoredChunks.push({
          documentId: doc._id,
          documentTitle: doc.title,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score,
        });
      }
    }
  }

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK);
}

module.exports = {
  chunkDocument,
  cosineSimilarity,
  searchKnowledgeBase,
};
