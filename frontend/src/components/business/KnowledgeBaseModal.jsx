import React, { useState, useEffect } from "react";
import { X, BookOpen, Upload, Trash2, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import useBusinessStore from "../../store/useBusinessStore";
import * as businessApi from "../../services/business.service";

const KnowledgeBaseModal = ({ isOpen, onClose }) => {
  const currentOrg = useBusinessStore((s) => s.currentOrg);
  const knowledgeDocs = useBusinessStore((s) => s.knowledgeDocs);
  const isLoadingDocs = useBusinessStore((s) => s.isLoadingDocs);
  const loadKnowledgeBase = useBusinessStore((s) => s.loadKnowledgeBase);
  const uploadDoc = useBusinessStore((s) => s.uploadDoc);
  const deleteDoc = useBusinessStore((s) => s.deleteDoc);

  const [activeTab, setActiveTab] = useState("docs"); // "docs" | "upload" | "test"
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("policies");
  const [newContent, setNewContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Test RAG Query state
  const [testQueryText, setTestQueryText] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen && currentOrg) {
      loadKnowledgeBase();
    }
  }, [isOpen, currentOrg, loadKnowledgeBase]);

  if (!isOpen) return null;

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Please fill in both title and document content");
      return;
    }

    setIsUploading(true);
    const res = await uploadDoc(newTitle.trim(), newContent.trim(), newCategory);
    setIsUploading(false);

    if (res) {
      setNewTitle("");
      setNewContent("");
      setActiveTab("docs");
    }
  };

  const handleTestQuery = async (e) => {
    e.preventDefault();
    if (!testQueryText.trim() || !currentOrg?._id) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await businessApi.queryKnowledgeBase(currentOrg._id, testQueryText.trim());
      setTestResult(res?.data || null);
    } catch (err) {
      toast.error("Error generating grounded answer");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626] rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]">
              <BookOpen size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Knowledge Base & RAG Engine
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">
                {currentOrg?.name} • Grounded AI Context & Semantic Chunking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-[#222222] px-6 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("docs")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "docs"
                ? "border-[#FF6B00] text-[#FF6B00]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Indexed Documents ({knowledgeDocs.length})
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "upload"
                ? "border-[#FF6B00] text-[#FF6B00]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Upload / Ingest Document
          </button>
          <button
            onClick={() => setActiveTab("test")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "test"
                ? "border-[#FF6B00] text-[#FF6B00]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Test Grounded Query
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "docs" && (
            <div>
              {isLoadingDocs ? (
                <div className="py-12 flex justify-center">
                  <div className="w-6 h-6 border-2 border-slate-300 dark:border-[#222222] border-t-[#FF6B00] rounded-full animate-spin" />
                </div>
              ) : knowledgeDocs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No documents indexed yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Upload policy documents, FAQs, or support manuals to ground Flash AI answers in your company information.
                  </p>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="mt-4 px-4 py-2 bg-[#FF6B00] text-white rounded-xl text-xs font-semibold hover:bg-[#E05E00]"
                  >
                    Upload Document
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledgeDocs.map((doc) => (
                    <div
                      key={doc._id}
                      className="p-4 rounded-xl border border-slate-100 dark:border-[#262626] bg-slate-50 dark:bg-[#1c1c1c] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 dark:text-white">
                            {doc.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#FF6B00]/10 text-[#FF6B00]">
                            {doc.category || "general"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-[#888888] mt-1">
                          {doc.totalChunks || 0} vectorized chunks • Status: {doc.status}
                        </p>
                      </div>

                      <button
                        onClick={() => deleteDoc(doc._id)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-[#262626] transition-colors"
                        title="Delete document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <form onSubmit={handleUploadSubmit} className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Return Policy & Warranty Terms"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
                >
                  <option value="policies">Company Policy</option>
                  <option value="faq">FAQ</option>
                  <option value="product">Product Documentation</option>
                  <option value="support">Customer Support Scripts</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A0A0A0] mb-1.5">
                  Document Content (Plaintext / Markdown) *
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste documentation text, FAQ answers, or product specifications here..."
                  rows={8}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2.5 font-semibold text-white bg-[#FF6B00] hover:bg-[#E05E00] rounded-xl shadow-md shadow-[#FF6B00]/25 transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                <span>Index into Knowledge Base</span>
              </button>
            </form>
          )}

          {activeTab === "test" && (
            <div className="space-y-4 max-w-xl mx-auto">
              <form onSubmit={handleTestQuery} className="flex gap-2">
                <input
                  type="text"
                  value={testQueryText}
                  onChange={(e) => setTestQueryText(e.target.value)}
                  placeholder="Ask a question grounded in knowledge base..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
                />
                <button
                  type="submit"
                  disabled={isTesting || !testQueryText.trim()}
                  className="px-4 py-2.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isTesting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  <span>Query</span>
                </button>
              </form>

              {testResult && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#1c1c1c] space-y-3">
                  <h4 className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} /> Grounded AI Response
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {testResult.answer}
                  </p>
                  {testResult.sources && testResult.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-[#262626] text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Sources: </span>
                      {testResult.sources.map((s, i) => (
                        <span key={i} className="mr-2">
                          {s.documentTitle} ({s.relevanceScore}% match)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;
