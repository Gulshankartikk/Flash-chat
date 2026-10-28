import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowLeft,
  X,
  History,
  Folder,
  Tag,
  Sparkles,
  Lock,
  KeyRound,
  ExternalLink,
  FileText,
  Bookmark,
  Check,
  Copy,
  Send,
  HelpCircle
} from 'lucide-react';
import { searchPocketItems, fetchPocketFolders, fetchPocketTags } from '../api/pocketApi';
import { usePocketStore } from '../store/usePocketStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { ItemCard } from '../components/ItemCard';
import { PinPadModal } from '../components/PinPadModal';
import {
  askPocketRAG,
  AiBadge,
  AiMarkdown,
  AiThinking,
  AiButton,
  AiConsentDialog
} from '../../ai';
import { saveAiAnswerToPocket } from '../hooks/useSaveToPocket';

const RECENT_SEARCHES_KEY = 'flashchat_pocket_recent_searches';

const SUGGESTED_AI_QUESTIONS = [
  'What are the key takeaways from my saved notes?',
  'List all my recent project ideas and bookmarks',
  'What did I save about travel or recipes?'
];

export const PocketSearchPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isUnlocked } = usePocketStore();
  const { user, updateProfile } = useAuthStore();

  const aiEnabled = user?.aiSettings?.aiEnabled ?? true;
  const initialMode = searchParams.get('mode') === 'ask' ? 'ask' : 'search';

  const [mode, setMode] = useState(initialMode); // 'search' | 'ask'
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [showPinModal, setShowPinModal] = useState(false);

  // Ask my Pocket (AI Q&A) state
  const [aiAnswerData, setAiAnswerData] = useState(null); // { answer: '', citations: [] }
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [isSavedToPocket, setIsSavedToPocket] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingAiQuery, setPendingAiQuery] = useState('');

  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Load recent search queries & metadata
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch (e) {}

    fetchPocketFolders().then((res) => setFolders(res.folders || [])).catch(() => {});
    fetchPocketTags().then((res) => setTags(res.tags || [])).catch(() => {});
  }, []);

  const addRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 10);
    setRecentSearches(updated);
    try {
      sessionStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    sessionStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Debounced search (300ms) for normal search mode
  const performSearch = useCallback(
    async (searchTerm, type, tag) => {
      if (mode === 'ask') return;
      if (!searchTerm && !tag && type === 'all') {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await searchPocketItems({
          q: searchTerm || undefined,
          type: type === 'all' ? undefined : type,
          tag: tag || undefined
        });
        setResults(res.items || []);
        if (searchTerm.trim()) {
          addRecentSearch(searchTerm);
        }
      } catch (err) {
        console.error('Pocket search failed', err);
      } finally {
        setIsLoading(false);
      }
    },
    [recentSearches, mode]
  );

  useEffect(() => {
    if (mode === 'search') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query, selectedType, selectedTag);
      }, 300);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, selectedType, selectedTag, mode, performSearch]);

  // Handle Ask My Pocket Execution
  const executeAskPocket = async (questionToAsk) => {
    const q = (questionToAsk || query).trim();
    if (!q) return;

    // Check opt-in consent
    const aiUsesPocket = user?.aiSettings?.aiUsesPocket ?? false;
    if (!aiUsesPocket) {
      setPendingAiQuery(q);
      setShowConsentDialog(true);
      return;
    }

    setIsAskingAi(true);
    setAiError(null);
    setAiAnswerData(null);
    setIsSavedToPocket(false);

    try {
      const res = await askPocketRAG({ question: q });
      setAiAnswerData(res);
      addRecentSearch(q);
    } catch (err) {
      setAiError(err.response?.data?.message || err.message || 'Failed to search your Pocket with AI.');
    } finally {
      setIsAskingAi(false);
    }
  };

  // Consent accepted
  const handleConsentAccept = async () => {
    setShowConsentDialog(false);
    try {
      await updateProfile({
        aiSettings: {
          ...(user?.aiSettings || {}),
          aiUsesPocket: true
        }
      });
      if (pendingAiQuery) {
        executeAskPocket(pendingAiQuery);
        setPendingAiQuery('');
      }
    } catch (err) {
      console.error('Failed to update AI settings:', err);
    }
  };

  // Save AI Answer to Pocket
  const handleSaveAnswer = async () => {
    if (!aiAnswerData?.answer || isSavedToPocket) return;
    try {
      await saveAiAnswerToPocket({
        text: aiAnswerData.answer,
        prompt: query,
        model: 'Flash AI',
        tags: ['ai-answer', 'pocket-qa']
      });
      setIsSavedToPocket(true);
    } catch (err) {
      alert('Failed to save AI answer to Pocket.');
    }
  };

  // Switch modes
  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setSearchParams(newMode === 'ask' ? { mode: 'ask' } : {});
    setResults([]);
    setAiAnswerData(null);
    setAiError(null);
  };

  return (
    <div className="min-h-screen bg-canvas p-3 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/pocket')}
          className="p-2 rounded-2xl bg-card border border-line text-ink hover:bg-line/40 transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Search Mode Segmented Tabs */}
        <div className="flex items-center bg-card p-1 rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => handleSwitchMode('search')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'search'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          {aiEnabled && (
            <button
              type="button"
              onClick={() => handleSwitchMode('ask')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'ask'
                  ? 'bg-brand-gradient text-white shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask my Pocket</span>
            </button>
          )}
        </div>
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'ask') executeAskPocket(query);
        }}
        className="relative flex items-center gap-2"
      >
        <div className="relative flex-1">
          {mode === 'ask' ? (
            <Sparkles className="w-4 h-4 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
          ) : (
            <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'ask'
                ? 'Ask anything across your Pocket notes, links & bookmarks...'
                : "Search everything in your Pocket... (Press '/' to focus)"
            }
            autoFocus
            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-card border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm placeholder:text-muted/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {mode === 'ask' && (
          <AiButton
            type="submit"
            size="md"
            loading={isAskingAi}
            disabled={!query.trim() || isAskingAi}
          >
            Ask AI
          </AiButton>
        )}
      </form>

      {/* ------------------------------------------------------------- */}
      {/* 1. ASK MY POCKET (AI RAG MODE) VIEW */}
      {/* ------------------------------------------------------------- */}
      {mode === 'ask' && (
        <div className="space-y-5">
          {/* Suggested Starter Questions */}
          {!aiAnswerData && !isAskingAi && (
            <div className="bg-card rounded-3xl p-5 border border-line shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Example Questions:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_AI_QUESTIONS.map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(sq);
                      executeAskPocket(sq);
                    }}
                    className="px-3 py-2 rounded-2xl bg-canvas border border-line text-xs font-medium text-ink hover:border-primary transition text-left cursor-pointer"
                  >
                    "{sq}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Thinking / Loading State */}
          {isAskingAi && (
            <div className="bg-card rounded-3xl p-8 border border-line shadow-sm flex flex-col items-center justify-center text-center space-y-3">
              <AiThinking />
              <p className="text-xs font-bold text-ink">Searching and synthesizing your Pocket items...</p>
              <p className="text-[11px] text-muted">
                Flash AI is reviewing unencrypted notes, links, and documents.
              </p>
            </div>
          )}

          {/* AI Error */}
          {aiError && (
            <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 text-xs text-[#F43F5E] space-y-2">
              <p className="font-bold">Could not complete query:</p>
              <p>{aiError}</p>
              <button
                type="button"
                onClick={() => executeAskPocket(query)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* AI Answer & Citation Card */}
          {aiAnswerData && !isAskingAi && (
            <div className="bg-card rounded-3xl p-6 border border-line shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <AiBadge label="Pocket Vault Answer" size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiAnswerData.answer);
                      alert('Answer copied to clipboard!');
                    }}
                    className="p-1.5 rounded-xl border border-line text-muted hover:text-ink hover:bg-line/40 transition cursor-pointer"
                    title="Copy Answer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAnswer}
                    disabled={isSavedToPocket}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                      isSavedToPocket
                        ? 'bg-card text-primary border border-primary/30'
                        : 'bg-brand-gradient text-white hover:opacity-95'
                    }`}
                  >
                    {isSavedToPocket ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved to Pocket</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Save as AI Answer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Answer Content */}
              <div className="text-sm text-ink leading-relaxed">
                <AiMarkdown content={aiAnswerData.answer} />
              </div>

              {/* Citations (Source Items) */}
              {aiAnswerData.citations && aiAnswerData.citations.length > 0 && (
                <div className="pt-4 border-t border-line space-y-2">
                  <span className="text-[11px] font-bold text-muted">Sources Consulted:</span>
                  <div className="flex flex-wrap gap-2">
                    {aiAnswerData.citations.map((c) => (
                      <button
                        key={c.itemId}
                        type="button"
                        onClick={() => navigate(`/pocket/item/${c.itemId}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas border border-line text-xs font-semibold text-ink hover:border-primary transition cursor-pointer"
                      >
                        <span className="font-bold text-primary">[{c.citationIndex}]</span>
                        <span className="truncate max-w-[160px]">{c.title}</span>
                        <ExternalLink className="w-3 h-3 text-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. STANDARD SEARCH MODE VIEW */}
      {/* ------------------------------------------------------------- */}
      {mode === 'search' && (
        <div className="space-y-6">
          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs bg-card border border-line rounded-xl px-3 py-1.5 text-ink font-semibold focus:outline-none shadow-sm"
            >
              <option value="all">All Types</option>
              <option value="note">Notes</option>
              <option value="link">Links</option>
              <option value="image">Photos</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="document">Documents</option>
              <option value="snippet">Snippets</option>
              <option value="message">From Chats</option>
              <option value="post">From Social</option>
              <option value="ai_answer">AI Answers</option>
            </select>

            {tags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="text-xs bg-card border border-line rounded-xl px-3 py-1.5 text-ink font-semibold focus:outline-none shadow-sm"
              >
                <option value="">All Tags</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    #{t.name} ({t.count})
                  </option>
                ))}
              </select>
            )}

            {(selectedType !== 'all' || selectedTag || query) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedType('all');
                  setSelectedTag('');
                  setQuery('');
                }}
                className="text-xs font-bold text-primary hover:underline px-2 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Recent Searches (when no active query) */}
          {!query && !selectedTag && recentSearches.length > 0 && (
            <div className="bg-card rounded-3xl p-5 border border-line shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <History className="w-4 h-4 text-primary" />
                  <span>Recent Searches</span>
                </div>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[11px] text-muted hover:text-rose-400 font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuery(s)}
                    className="px-3 py-1.5 rounded-xl bg-canvas border border-line text-xs font-medium text-ink hover:bg-line/40 transition cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className="h-32 bg-card rounded-3xl border border-line p-4 animate-pulse"
                />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-muted">
                <span>{results.length} results found</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((item) => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    onRequireUnlock={() => setShowPinModal(true)}
                  />
                ))}
              </div>
            </div>
          ) : (query || selectedTag) && !isLoading ? (
            <div className="bg-card rounded-3xl p-12 border border-line text-center space-y-2 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-canvas border border-line flex items-center justify-center text-2xl mx-auto">
                🔍
              </div>
              <h3 className="text-sm font-black text-ink">No matching Pocket items</h3>
              <p className="text-xs text-muted">Try adjusting your search terms or filters.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Privacy Notice Card */}
      <div className="p-4 bg-card rounded-3xl border border-line shadow-sm space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-1.5 font-bold text-ink">
          <KeyRound className="w-3.5 h-3.5 text-primary" />
          <span>Search Privacy Notice</span>
        </p>
        <p className="text-[11px] leading-relaxed">
          Client-side encrypted items are never indexed on the server and cannot be searched or accessed by AI. Locked
          vault items only appear in search results when the vault is unlocked.
        </p>
      </div>

      {/* Pin Pad Modal for unlocking vault */}
      <PinPadModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => performSearch(query, selectedType, selectedTag)}
        mode="unlock"
      />

      {/* AI Consent Dialog for Pocket Opt-in */}
      <AiConsentDialog
        isOpen={showConsentDialog}
        onClose={() => setShowConsentDialog(false)}
        onAccept={handleConsentAccept}
        featureName="Ask my Pocket"
        description="Ask my Pocket analyzes only your top matching unencrypted personal vault notes, bookmarks, and links with Flash AI to synthesize answers. Client-side encrypted notes and locked items without unlock token are never sent."
      />
    </div>
  );
};

export default PocketSearchPage;
