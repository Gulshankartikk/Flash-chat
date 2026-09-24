const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema(
  {
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] }, // vector representations for semantic search
    tokenCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ["pdf", "txt", "md", "json", "faq"],
      default: "txt",
    },
    category: {
      type: String,
      default: "general",
    },
    rawContent: {
      type: String,
      default: "",
    },
    chunks: [chunkSchema],
    totalChunks: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["indexing", "ready", "failed"],
      default: "ready",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

knowledgeDocumentSchema.index({ organization: 1, status: 1 });
knowledgeDocumentSchema.index({ organization: 1, title: 1 });

module.exports =
  mongoose.models.KnowledgeDocument ||
  mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);
