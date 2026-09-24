const KnowledgeDocument = require("../models/KnowledgeDocument");
const AuditLog = require("../models/AuditLog");
const aiService = require("../services/ai/ai.service");
const { chunkDocument } = require("../services/ai/ai.rag");
const response = require("../utils/responseHandler");

/**
 * Upload and index a new knowledge base document
 */
const uploadDocument = async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { title, content, fileType = "txt", category = "general" } = req.body;

    if (!title || !title.trim()) {
      return response(res, 400, "Document title is required");
    }

    if (!content || !content.trim()) {
      return response(res, 400, "Document content is required");
    }

    // 1. Create document record in indexing state
    const doc = await KnowledgeDocument.create({
      organization: orgId,
      title: title.trim(),
      fileType,
      category,
      rawContent: content,
      status: "indexing",
      uploadedBy: req.user._id,
    });

    // 2. Chunk document
    const rawChunks = chunkDocument(content, 350, 40);

    // 3. Generate embeddings for each chunk
    const embeddedChunks = [];
    for (const chunk of rawChunks) {
      const embedding = await aiService.primaryProvider.embedText(chunk.text);
      embeddedChunks.push({
        ...chunk,
        embedding,
      });
    }

    doc.chunks = embeddedChunks;
    doc.totalChunks = embeddedChunks.length;
    doc.status = "ready";
    await doc.save();

    await AuditLog.create({
      organization: orgId,
      actor: req.user._id,
      action: "KNOWLEDGE_DOCUMENT_UPLOADED",
      entityType: "KnowledgeDocument",
      entityId: String(doc._id),
      details: { title, totalChunks: doc.totalChunks },
    });

    return response(res, 201, "Document indexed into Knowledge Base successfully", {
      _id: doc._id,
      title: doc.title,
      totalChunks: doc.totalChunks,
      status: doc.status,
      category: doc.category,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error("[KBController] uploadDocument error:", err);
    return response(res, 500, "Failed to index document", null, err.message);
  }
};

/**
 * List all knowledge base documents for the organization
 */
const getDocuments = async (req, res) => {
  try {
    const orgId = req.organization._id;
    const docs = await KnowledgeDocument.find({ organization: orgId })
      .select("title fileType category totalChunks status createdAt uploadedBy")
      .populate("uploadedBy", "username email");

    return response(res, 200, "Knowledge base documents retrieved", docs);
  } catch (err) {
    console.error("[KBController] getDocuments error:", err);
    return response(res, 500, "Failed to retrieve documents", null, err.message);
  }
};

/**
 * Delete a knowledge base document
 */
const deleteDocument = async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { docId } = req.params;

    const doc = await KnowledgeDocument.findOneAndDelete({
      _id: docId,
      organization: orgId,
    });

    if (!doc) {
      return response(res, 404, "Document not found in organization");
    }

    await AuditLog.create({
      organization: orgId,
      actor: req.user._id,
      action: "KNOWLEDGE_DOCUMENT_DELETED",
      entityType: "KnowledgeDocument",
      entityId: String(docId),
      details: { title: doc.title },
    });

    return response(res, 200, "Document removed from Knowledge Base");
  } catch (err) {
    console.error("[KBController] deleteDocument error:", err);
    return response(res, 500, "Failed to delete document", null, err.message);
  }
};

/**
 * Test RAG grounded query against the organization's knowledge base
 */
const testQuery = async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { query } = req.body;

    if (!query || !query.trim()) {
      return response(res, 400, "Search query is required");
    }

    const result = await aiService.groundQuery(query, orgId, req.user._id);
    return response(res, 200, "Grounded answer generated", result);
  } catch (err) {
    console.error("[KBController] testQuery error:", err);
    return response(res, 500, "Failed to query knowledge base", null, err.message);
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument,
  testQuery,
};
