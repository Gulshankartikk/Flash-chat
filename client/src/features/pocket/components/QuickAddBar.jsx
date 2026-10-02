import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  FileUp,
  Mic,
  Code2,
  Send,
  Loader2,
  Square,
  CheckCircle2,
  X,
  ExternalLink
} from 'lucide-react';
import { fetchLinkPreview, createPocketItem, uploadPocketFile } from '../api/pocketApi';

export const QuickAddBar = ({ onItemCreated, folders = [] }) => {
  const [activeTab, setActiveTab] = useState(null); // 'note' | 'link' | 'voice' | 'snippet' | null
  const [inputText, setInputText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [snippetLang, setSnippetLang] = useState('javascript');
  const [previewData, setPreviewData] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const fileInputRef = useRef(null);
  const mediaInputRef = useRef(null);

  // Link preview debounced fetch when pasting URL
  useEffect(() => {
    if (!urlInput.trim()) {
      setPreviewData(null);
      return;
    }

    try {
      const urlObj = new URL(urlInput.trim());
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        setIsPreviewLoading(true);
        const timer = setTimeout(async () => {
          try {
            const res = await fetchLinkPreview(urlInput.trim());
            if (res.preview) {
              setPreviewData(res.preview);
            }
          } catch (e) {
            setPreviewData(null);
          } finally {
            setIsPreviewLoading(false);
          }
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      setPreviewData(null);
      setIsPreviewLoading(false);
    }
  }, [urlInput]);

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await handleUploadVoiceMemo(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access was denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleUploadVoiceMemo = async (blob) => {
    setIsSubmitting(true);
    try {
      const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
      const uploadRes = await uploadPocketFile(file);
      const mediaItem = {
        url: uploadRes.url,
        publicId: uploadRes.publicId || '',
        mimeType: 'audio/webm',
        size: blob.size,
        duration: recordingSeconds
      };

      const newItem = await createPocketItem({
        type: 'audio',
        title: `Voice Note (${recordingSeconds}s)`,
        content: `Recorded voice memo on ${new Date().toLocaleDateString()}`,
        media: [mediaItem],
        folder: selectedFolder || null,
        tags: ['voice-note']
      });

      onItemCreated?.(newItem.item);
      setActiveTab(null);
    } catch (err) {
      alert(err.message || 'Failed to save voice note');
    } finally {
      setIsSubmitting(false);
      setRecordingSeconds(0);
    }
  };

  // File & Media file change handler
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      const uploadRes = await uploadPocketFile(file);
      const mediaItem = {
        url: uploadRes.url,
        publicId: uploadRes.publicId || '',
        mimeType: file.type,
        size: file.size,
        thumbnail: file.type.startsWith('image/') ? uploadRes.url : ''
      };

      const newItem = await createPocketItem({
        type: type === 'media' ? (file.type.startsWith('video/') ? 'video' : 'image') : 'document',
        title: file.name,
        media: [mediaItem],
        folder: selectedFolder || null,
        tags: [type]
      });

      onItemCreated?.(newItem.item);
    } catch (err) {
      alert(err.message || 'Failed to upload attachment.');
    } finally {
      setIsSubmitting(false);
      if (e.target) e.target.value = '';
    }
  };

  // Submit Note or Snippet or Link
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'note') {
      if (!inputText.trim()) return;
      setIsSubmitting(true);
      try {
        const titleLine = inputText.trim().split('\n')[0].slice(0, 60);
        const res = await createPocketItem({
          type: 'note',
          title: titleLine || 'Quick Note',
          content: inputText.trim(),
          folder: selectedFolder || null,
          tags: ['quick-note']
        });
        onItemCreated?.(res.item);
        setInputText('');
        setActiveTab(null);
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
    } else if (activeTab === 'snippet') {
      if (!inputText.trim()) return;
      setIsSubmitting(true);
      try {
        const res = await createPocketItem({
          type: 'snippet',
          title: `Code Snippet (${snippetLang})`,
          content: `\`\`\`${snippetLang}\n${inputText.trim()}\n\`\`\``,
          folder: selectedFolder || null,
          tags: ['snippet', snippetLang]
        });
        onItemCreated?.(res.item);
        setInputText('');
        setActiveTab(null);
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
    } else if (activeTab === 'link') {
      if (!urlInput.trim()) return;
      setIsSubmitting(true);
      try {
        const res = await createPocketItem({
          type: 'link',
          title: previewData?.title || urlInput.trim(),
          content: previewData?.description || inputText.trim(),
          url: urlInput.trim(),
          linkPreview: previewData || undefined,
          folder: selectedFolder || null,
          tags: ['link']
        });
        onItemCreated?.(res.item);
        setUrlInput('');
        setInputText('');
        setPreviewData(null);
        setActiveTab(null);
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl p-3 sm:p-4 border border-[#FED7AA] shadow-sm space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'media')}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip,.csv"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'document')}
      />

      {/* Button Row */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveTab(activeTab === 'note' ? null : 'note')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex-shrink-0 ${
            activeTab === 'note'
              ? 'bg-[#F97316] text-white shadow-md shadow-orange-500/20'
              : 'bg-[#FFF7ED] text-[#1F2937] hover:bg-[#FED7AA]/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Note</span>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'link' ? null : 'link')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex-shrink-0 ${
            activeTab === 'link'
              ? 'bg-[#F97316] text-white shadow-md shadow-orange-500/20'
              : 'bg-[#FFF7ED] text-[#1F2937] hover:bg-[#FED7AA]/50'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Link</span>
        </button>

        <button
          onClick={() => mediaInputRef.current?.click()}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-[#FFF7ED] text-[#1F2937] hover:bg-[#FED7AA]/50 transition-all flex-shrink-0 disabled:opacity-50"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#EC4899]" />
          <span>Photo / Video</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-[#FFF7ED] text-[#1F2937] hover:bg-[#FED7AA]/50 transition-all flex-shrink-0 disabled:opacity-50"
        >
          <FileUp className="w-3.5 h-3.5 text-amber-600" />
          <span>File</span>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'voice' ? null : 'voice')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex-shrink-0 ${
            activeTab === 'voice'
              ? 'bg-[#F97316] text-white shadow-md shadow-orange-500/20'
              : 'bg-[#FFF7ED] text-[#1F2937] hover:bg-[#FED7AA]/50'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-rose-500" />
          <span>Voice</span>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'snippet' ? null : 'snippet')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex-shrink-0 ${
            activeTab === 'snippet'
              ? 'bg-[#F97316] text-white shadow-md shadow-orange-500/20'
              : 'bg-[#FFF7ED] text-[#1F2937] hover:bg-[#FED7AA]/50'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-indigo-500" />
          <span>Snippet</span>
        </button>
      </div>

      {/* Expanded Quick-add Panels */}
      <AnimatePresence>
        {activeTab && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2 border-t border-[#FED7AA]/60 space-y-3"
          >
            {/* Folder selection dropdown if folders exist */}
            {folders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#6B7280]">Folder:</span>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="text-xs bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-2.5 py-1 text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                >
                  <option value="">General (Unorganized)</option>
                  {folders.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Note Panel */}
            {activeTab === 'note' && (
              <form onSubmit={handleSubmit} className="space-y-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Jot down a quick thought or note... (Markdown supported)"
                  rows={3}
                  autoFocus
                  className="w-full text-xs p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 resize-none placeholder:text-[#6B7280]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="px-3 py-1.5 text-xs text-[#6B7280] font-semibold hover:text-[#1F2937]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-sm disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Save Note</span>
                  </button>
                </div>
              </form>
            )}

            {/* Link Panel */}
            {activeTab === 'link' && (
              <form onSubmit={handleSubmit} className="space-y-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste URL (e.g. https://github.com)..."
                  autoFocus
                  className="w-full text-xs p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 placeholder:text-[#6B7280]"
                />

                {/* Link Preview Loading Skeleton */}
                {isPreviewLoading && (
                  <div className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA] flex items-center gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-[#FED7AA]/50 rounded-xl" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-[#FED7AA]/60 rounded w-2/3" />
                      <div className="h-2 bg-[#FED7AA]/40 rounded w-1/2" />
                    </div>
                  </div>
                )}

                {/* Populated Link Preview Card */}
                {previewData && !isPreviewLoading && (
                  <div className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA] flex items-start gap-3">
                    {previewData.image && (
                      <img
                        src={previewData.image}
                        alt="Preview"
                        className="w-14 h-14 object-cover rounded-xl border border-[#FED7AA]/50 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1F2937] truncate">{previewData.title}</p>
                      <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-0.5">{previewData.description}</p>
                      <span className="text-[10px] text-[#F97316] font-semibold mt-1 inline-block">
                        {previewData.siteName || new URL(urlInput).hostname}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="px-3 py-1.5 text-xs text-[#6B7280] font-semibold hover:text-[#1F2937]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!urlInput.trim() || isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-sm disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Save Link</span>
                  </button>
                </div>
              </form>
            )}

            {/* Snippet Panel */}
            {activeTab === 'snippet' && (
              <form onSubmit={handleSubmit} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#6B7280]">Language:</span>
                  <select
                    value={snippetLang}
                    onChange={(e) => setSnippetLang(e.target.value)}
                    className="text-xs bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-2.5 py-1 text-[#1F2937] focus:outline-none"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="json">JSON</option>
                    <option value="sql">SQL</option>
                    <option value="bash">Bash</option>
                  </select>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="// Paste your code snippet here..."
                  rows={4}
                  autoFocus
                  className="w-full text-xs font-mono p-3 bg-[#1F2937] border border-gray-700 rounded-2xl text-amber-200 focus:outline-none resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="px-3 py-1.5 text-xs text-[#6B7280] font-semibold hover:text-[#1F2937]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-sm disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Save Snippet</span>
                  </button>
                </div>
              </form>
            )}

            {/* Voice Memo Panel */}
            {activeTab === 'voice' && (
              <div className="p-4 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA] flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  {isRecording && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />}
                  <span className="text-sm font-mono font-bold text-[#1F2937]">
                    {Math.floor(recordingSeconds / 60)
                      .toString()
                      .padStart(2, '0')}
                    :
                    {(recordingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-2xl bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 active:scale-95 disabled:opacity-50"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-4 py-2 rounded-2xl bg-[#1F2937] text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 animate-pulse"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Stop & Save</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isRecording) stopRecording();
                      setActiveTab(null);
                    }}
                    className="px-3 py-1.5 text-xs text-[#6B7280] font-semibold hover:text-[#1F2937]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
