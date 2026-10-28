import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Image,
  Film,
  Sparkles,
  MapPin,
  Lock,
  MessageSquare,
  Upload,
  Crop,
  Check,
  AlertCircle
} from 'lucide-react';
import { useSocialStore } from '../store/useSocialStore';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  createPostApi,
  createReelApi,
  createStoryApi,
  uploadMediaFile,
  searchUsersAndTagsApi
} from '../api/api';
import {
  generateSocialCaption,
  suggestSocialHashtags,
  moderateSocialContent,
  describeSocialImage,
  AiBadge,
  AiThinking,
  AiButton
} from '../../ai';

export const CreateSocialModal = () => {
  const { user } = useAuthStore();
  const aiEnabled = user?.aiSettings?.aiEnabled ?? true;
  const { isCreateModalOpen, closeCreateModal, createType: initialType } = useSocialStore();

  const [activeType, setActiveType] = useState('post'); // 'post' | 'reel' | 'story'
  const [storyTab, setStoryTab] = useState('media'); // 'media' | 'text'
  const [statusBgColor, setStatusBgColor] = useState('#10B981'); // WhatsApp green default
  const [statusFontStyle, setStatusFontStyle] = useState('sans'); // 'sans' | 'serif' | 'mono' | 'cursive'
  const [statusTextAlign, setStatusTextAlign] = useState('center'); // 'left' | 'center' | 'right'
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, previewUrl, type, width, height, duration }
  const [cropAspect, setCropAspect] = useState('square'); // 'square' (1:1) | 'portrait' (4:5) | 'original'
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [audioName, setAudioName] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const [isAiAssisted, setIsAiAssisted] = useState(false);

  // AI states
  const [selectedTone, setSelectedTone] = useState('fun'); // 'fun' | 'professional' | 'short' | 'poetic'
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [isDescribingImage, setIsDescribingImage] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState([]);
  const [moderationWarning, setModerationWarning] = useState(null); // { reason, categories }

  // Autocomplete state for hashtags & mentions
  const [autocompleteQuery, setAutocompleteQuery] = useState(null); // { type: 'tag'|'user', query: '' }
  const [autocompleteResults, setAutocompleteResults] = useState({ users: [], tags: [] });

  // Uploading & progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const abortControllerRef = useRef(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isCreateModalOpen) {
      setActiveType(initialType || 'post');
      resetForm();
    }
  }, [isCreateModalOpen, initialType]);

  const resetForm = () => {
    setSelectedFiles([]);
    setCropAspect('square');
    setCaption('');
    setLocation('');
    setAudioName('');
    setAllowComments(true);
    setCloseFriendsOnly(false);
    setIsAiAssisted(false);
    setIsGeneratingCaption(false);
    setIsSuggestingTags(false);
    setIsDescribingImage(false);
    setSuggestedHashtags([]);
    setModerationWarning(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setAutocompleteQuery(null);
  };

  // Caption change with autocomplete detection
  const handleCaptionChange = async (e) => {
    const val = e.target.value;
    setCaption(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('#') && lastWord.length > 1) {
      const q = lastWord.slice(1);
      setAutocompleteQuery({ type: 'tag', query: q });
      const res = await searchUsersAndTagsApi(q);
      if (res.success) setAutocompleteResults(res.data);
    } else if (lastWord.startsWith('@') && lastWord.length > 1) {
      const q = lastWord.slice(1);
      setAutocompleteQuery({ type: 'user', query: q });
      const res = await searchUsersAndTagsApi(q);
      if (res.success) setAutocompleteResults(res.data);
    } else {
      setAutocompleteQuery(null);
    }
  };

  const handleApplyAutocomplete = (replacement) => {
    const words = caption.split(/\s+/);
    words.pop();
    const prefix = autocompleteQuery?.type === 'tag' ? '#' : '@';
    const newCaption = `${words.join(' ')} ${prefix}${replacement} `;
    setCaption(newCaption.trimStart());
    setAutocompleteQuery(null);
  };

  // File selection with validation
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadError(null);

    if (activeType === 'post') {
      const maxLimit = 10;
      if (files.length > maxLimit) {
        setUploadError(`You can upload a maximum of ${maxLimit} media items for a post.`);
        return;
      }
      processFiles(files);
    } else if (activeType === 'reel') {
      const video = files[0];
      if (!video.type.startsWith('video/')) {
        setUploadError('Reels must be a video file.');
        return;
      }
      // Check duration <= 90s
      const tempVideo = document.createElement('video');
      tempVideo.src = URL.createObjectURL(video);
      tempVideo.onloadedmetadata = () => {
        if (tempVideo.duration > 90) {
          setUploadError('Reel videos must be 90 seconds or shorter.');
        } else {
          processFiles([video]);
        }
      };
      tempVideo.onerror = () => {
        processFiles([video]);
      };
    } else if (activeType === 'story') {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        const tempVideo = document.createElement('video');
        tempVideo.src = URL.createObjectURL(file);
        tempVideo.onloadedmetadata = () => {
          if (tempVideo.duration > 30) {
            setUploadError('Story videos must be 30 seconds or shorter.');
          } else {
            processFiles([file]);
          }
        };
        tempVideo.onerror = () => {
          processFiles([file]);
        };
      } else {
        processFiles([file]);
      }
    }
  };

  const processFiles = (files) => {
    const items = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }));
    setSelectedFiles(items);
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Apply canvas crop to image
  const cropImageToCanvas = (file, aspect) => {
    return new Promise((resolve) => {
      if (aspect === 'original' || file.type.startsWith('video/')) {
        return resolve(file);
      }

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (aspect === 'square') {
          const side = Math.min(img.width, img.height);
          canvas.width = side;
          canvas.height = side;
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);
        } else if (aspect === 'portrait') {
          // 4:5 ratio
          const targetH = Math.min(img.height, (img.width * 5) / 4);
          const targetW = (targetH * 4) / 5;
          canvas.width = targetW;
          canvas.height = targetH;
          const sx = (img.width - targetW) / 2;
          const sy = (img.height - targetH) / 2;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, targetW, targetH, 0, 0, targetW, targetH);
        }

        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const croppedFile = new File([blob], file.name, { type: file.type });
          resolve(croppedFile);
        }, file.type);
      };
      img.onerror = () => resolve(file);
    });
  };

  // AI Handlers
  const handleGenerateCaption = async () => {
    setIsGeneratingCaption(true);
    try {
      const res = await generateSocialCaption({
        description: caption || (activeType === 'reel' ? 'A creative video reel' : 'A photo post'),
        tone: selectedTone
      });
      if (res?.caption) {
        setCaption(res.caption);
        if (res.hashtags && Array.isArray(res.hashtags)) {
          setSuggestedHashtags(res.hashtags);
        }
      }
    } catch (err) {
      console.error('Caption generation error:', err);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleSuggestHashtags = async () => {
    if (!caption.trim()) return;
    setIsSuggestingTags(true);
    try {
      const tags = await suggestSocialHashtags({ caption: caption.trim() });
      if (Array.isArray(tags)) {
        setSuggestedHashtags(tags);
      }
    } catch (err) {
      console.error('Hashtags suggestion error:', err);
    } finally {
      setIsSuggestingTags(false);
    }
  };

  const handleDescribeImage = async () => {
    if (selectedFiles.length === 0) return;
    setIsDescribingImage(true);
    try {
      const res = await describeSocialImage({
        prompt: 'Describe this image in 1-2 sentences for alt text accessibility and caption.'
      });
      if (res?.description) {
        setCaption((prev) => (prev ? `${prev}\n\n${res.description}` : res.description));
      }
    } catch (err) {
      console.error('Image describe error:', err);
    } finally {
      setIsDescribingImage(false);
    }
  };

  const handleAddHashtag = (tag) => {
    const clean = tag.startsWith('#') ? tag : `#${tag}`;
    if (!caption.includes(clean)) {
      setCaption((prev) => `${prev.trim()} ${clean} `.trimStart());
    }
  };

  // Final Publish Handler
  const handlePublish = async (skipModeration = false) => {
    // Text Status direct flow
    if (activeType === 'story' && storyTab === 'text') {
      if (!caption.trim()) {
        setUploadError('Please write some text for your status.');
        return;
      }
      setIsUploading(true);
      setUploadProgress(50);
      setUploadError(null);
      try {
        await createStoryApi({
          media: { type: 'text' },
          text: caption.trim(),
          backgroundColor: statusBgColor,
          fontStyle: statusFontStyle,
          textAlign: statusTextAlign,
          closeFriendsOnly
        });
        setUploadProgress(100);
        setTimeout(() => {
          closeCreateModal();
          window.location.reload();
        }, 400);
      } catch (err) {
        setUploadError(err.response?.data?.message || 'Failed to publish status');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (selectedFiles.length === 0) {
      setUploadError('Please choose media to upload.');
      return;
    }

    // Run non-blocking moderation check first (timeout 4s)
    if (aiEnabled && caption.trim() && !skipModeration) {
      try {
        const modPromise = moderateSocialContent({ text: caption.trim() });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
        const modRes = await Promise.race([modPromise, timeoutPromise]);
        if (modRes?.flagged) {
          setModerationWarning(modRes);
          return;
        }
      } catch (err) {
        // Non-blocking fallback
      }
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadError(null);
    setModerationWarning(null);

    abortControllerRef.current = new AbortController();

    try {
      // 1. Process crops & Upload each media file
      const uploadedMedia = [];
      const totalCount = selectedFiles.length;

      for (let i = 0; i < totalCount; i++) {
        const item = selectedFiles[i];
        const fileToUpload = await cropImageToCanvas(item.file, cropAspect);

        const uploadRes = await uploadMediaFile(
          fileToUpload,
          (pct) => {
            const stepProgress = Math.round((i / totalCount) * 100 + (pct / totalCount) * 0.8);
            setUploadProgress(Math.min(stepProgress, 90));
          },
          abortControllerRef.current.signal
        );

        if (uploadRes && (uploadRes.success || uploadRes.url)) {
          uploadedMedia.push({
            url: uploadRes.url,
            publicId: uploadRes.publicId || uploadRes.public_id || '',
            type: uploadRes.type || item.type,
            thumbnail: uploadRes.thumbnail || uploadRes.url,
            width: uploadRes.width,
            height: uploadRes.height,
            duration: uploadRes.duration
          });
        }
      }

      if (uploadedMedia.length === 0) {
        throw new Error('Media upload failed. Please try again.');
      }

      setUploadProgress(95);

      const finalCaption = isAiAssisted && !caption.includes('#AIAssisted')
        ? `${caption.trim()} #AIAssisted`
        : caption.trim();

      // 2. Dispatch to specific API endpoint
      if (activeType === 'post') {
        await createPostApi(
          {
            media: uploadedMedia,
            caption: finalCaption,
            location: location.trim(),
            allowComments
          },
          null,
          abortControllerRef.current.signal
        );
      } else if (activeType === 'reel') {
        const reelMedia = uploadedMedia[0];
        if (!reelMedia || !reelMedia.url) {
          throw new Error('Reel video upload failed. Please select a valid video file.');
        }

        await createReelApi(
          {
            video: {
              url: reelMedia.url,
              publicId: reelMedia.publicId || '',
              thumbnail: reelMedia.thumbnail || reelMedia.url,
              duration: reelMedia.duration || 0,
              width: reelMedia.width || 1080,
              height: reelMedia.height || 1920
            },
            media: reelMedia,
            thumbnail: reelMedia.thumbnail || reelMedia.url,
            caption: finalCaption,
            audioName: audioName.trim() || 'Original Audio',
            allowComments
          },
          null,
          abortControllerRef.current.signal
        );
      } else if (activeType === 'story') {
        await createStoryApi(
          {
            media: uploadedMedia[0],
            text: finalCaption,
            closeFriendsOnly
          },
          null,
          abortControllerRef.current.signal
        );
      }

      setUploadProgress(100);
      setTimeout(() => {
        closeCreateModal();
        window.location.reload(); // Refresh feed to load new post/reel/story
      }, 500);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        console.log('Upload canceled');
      } else {
        console.error('Publish error:', err);
        setUploadError(err.response?.data?.message || err.message || 'Upload failed. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (!isCreateModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-card rounded-3xl border border-line shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Create New</h3>
            <div className="flex items-center gap-1 bg-canvas p-1 rounded-full border border-line">
              <button
                type="button"
                onClick={() => {
                  setActiveType('post');
                  resetForm();
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeType === 'post'
                    ? 'bg-brand-gradient text-white shadow-xs'
                    : 'text-muted'
                }`}
              >
                Post
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveType('reel');
                  resetForm();
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeType === 'reel'
                    ? 'bg-brand-gradient text-white shadow-xs'
                    : 'text-muted'
                }`}
              >
                Reel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveType('story');
                  resetForm();
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeType === 'story'
                    ? 'bg-brand-gradient text-white shadow-xs'
                    : 'text-muted'
                }`}
              >
                Story
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCreateModal}
            className="p-1.5 rounded-full hover:bg-primary/10 text-muted hover:text-ink transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {uploadError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-accent flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Story Sub-type Toggle (Media vs Text Status) */}
          {activeType === 'story' && (
            <div className="flex items-center gap-2 p-1 bg-canvas rounded-2xl border border-line">
              <button
                type="button"
                onClick={() => setStoryTab('media')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  storyTab === 'media'
                    ? 'bg-brand-gradient text-white shadow-xs'
                    : 'text-muted'
                }`}
              >
                Photo / Video Story
              </button>
              <button
                type="button"
                onClick={() => setStoryTab('text')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  storyTab === 'text'
                    ? 'bg-brand-gradient text-white shadow-xs'
                    : 'text-muted'
                }`}
              >
                WhatsApp Text Status
              </button>
            </div>
          )}

          {/* Media Picker OR Text Status Editor Canvas */}
          {activeType === 'story' && storyTab === 'text' ? (
            <div className="space-y-3">
              {/* Live Status Canvas Preview */}
              <div
                style={{ backgroundColor: statusBgColor }}
                className="relative w-full aspect-square rounded-2xl p-6 flex flex-col items-center justify-center text-white shadow-md transition-colors"
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Type a status..."
                  style={{
                    fontFamily:
                      statusFontStyle === 'serif'
                        ? 'Georgia, serif'
                        : statusFontStyle === 'mono'
                        ? 'monospace'
                        : statusFontStyle === 'cursive'
                        ? 'cursive'
                        : 'sans-serif',
                    textAlign: statusTextAlign
                  }}
                  className="w-full bg-transparent text-white placeholder-white/60 text-lg font-bold border-none focus:outline-none resize-none"
                  rows={4}
                />
              </div>

              {/* Background Colors Palette */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-muted">Background Color:</span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {['#10B981', '#059669', '#6366F1', '#EC4899', '#F59E0B', '#8B5CF6', '#3B82F6', '#EF4444', '#1F2937'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStatusBgColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer shrink-0 ${
                        statusBgColor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Font Style & Text Align */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted">Font:</span>
                  {['sans', 'serif', 'mono', 'cursive'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFontStyle(f)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                        statusFontStyle === f ? 'bg-primary text-white shadow-xs' : 'bg-cream text-muted hover:text-ink'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  {['left', 'center', 'right'].map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setStatusTextAlign(align)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                        statusTextAlign === align ? 'bg-primary text-white shadow-xs' : 'bg-cream text-muted hover:text-ink'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : selectedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video rounded-2xl border-2 border-dashed border-line bg-canvas/50 hover:bg-canvas transition flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-card border border-line flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-ink">Click to upload media</p>
              <p className="text-[11px] text-muted mt-1">
                {activeType === 'post'
                  ? 'Up to 10 photos or videos'
                  : activeType === 'reel'
                  ? 'MP4 or WebM video (up to 90s)'
                  : 'Photo or short video (up to 30s)'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple={activeType === 'post'}
                accept={activeType === 'reel' ? 'video/*' : 'image/*,video/*'}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Media Preview Box */}
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                {selectedFiles[0]?.type === 'video' ? (
                  <video
                    src={selectedFiles[0]?.previewUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={selectedFiles[0]?.previewUrl}
                    alt="Preview"
                    className={`w-full h-full ${
                      cropAspect === 'square'
                        ? 'object-cover'
                        : cropAspect === 'portrait'
                        ? 'object-cover aspect-[4/5]'
                        : 'object-contain'
                    }`}
                  />
                )}

                {/* Change media button */}
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                  title="Remove and pick again"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Crop Aspect selector for images */}
              {selectedFiles[0]?.type === 'image' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted">Ratio:</span>
                  <div className="flex items-center gap-1.5">
                    {['square', 'portrait', 'original'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCropAspect(mode)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition cursor-pointer ${
                          cropAspect === mode
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-canvas text-muted hover:text-ink'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Caption Textarea with live Autocomplete */}
          <div className="relative space-y-1">
            <label className="text-xs font-bold text-ink">Caption</label>
            <textarea
              rows={3}
              value={caption}
              onChange={handleCaptionChange}
              placeholder={
                activeType === 'story'
                  ? 'Add text on story (optional)...'
                  : 'Write a caption with #hashtags and @mentions...'
              }
              className="w-full p-3 rounded-2xl border border-line bg-canvas text-xs text-ink placeholder-muted focus:outline-hidden focus:border-primary transition"
            />

            {/* Autocomplete dropdown suggestions */}
            {autocompleteQuery && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-card rounded-2xl border border-line shadow-xl p-2 max-h-36 overflow-y-auto space-y-1">
                {autocompleteQuery.type === 'tag' &&
                  (autocompleteResults.tags?.length > 0 ? (
                    autocompleteResults.tags.map((tag) => (
                      <div
                        key={tag.tag}
                        onClick={() => handleApplyAutocomplete(tag.tag)}
                        className="p-1.5 rounded-xl hover:bg-primary/10 cursor-pointer flex items-center justify-between text-xs font-semibold text-ink"
                      >
                        <span className="text-primary">#{tag.tag}</span>
                        <span className="text-[10px] text-muted">{tag.count} posts</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted p-1">No matching tags</p>
                  ))}

                {autocompleteQuery.type === 'user' &&
                  (autocompleteResults.users?.length > 0 ? (
                    autocompleteResults.users.map((u) => (
                      <div
                        key={u._id}
                        onClick={() => handleApplyAutocomplete(u.username)}
                        className="p-1.5 rounded-xl hover:bg-primary/10 cursor-pointer flex items-center gap-2 text-xs font-semibold text-ink"
                      >
                        <span className="text-secondary">@{u.username}</span>
                        <span className="text-[10px] text-muted">{u.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted p-1">No matching users</p>
                  ))}
              </div>
            )}
          </div>

          {/* AI Assistant Tools (Caption, Tone, Hashtags, Alt-Text) */}
          {aiEnabled && (
            <div className="p-3 bg-canvas rounded-2xl border border-line space-y-2.5">
              <div className="flex items-center justify-between">
                <AiBadge label="Flash AI Assistant" size="xs" />
                {selectedFiles.length > 0 && selectedFiles[0]?.type === 'image' && (
                  <button
                    type="button"
                    onClick={handleDescribeImage}
                    disabled={isDescribingImage}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isDescribingImage ? 'Describing...' : 'Describe Image'}</span>
                  </button>
                )}
              </div>

              {/* Tone chips + Generate caption */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-muted">Tone:</span>
                  {['fun', 'professional', 'short', 'poetic'].map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setSelectedTone(tone)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize transition cursor-pointer ${
                        selectedTone === tone
                          ? 'bg-brand-gradient text-white shadow-xs'
                          : 'bg-card text-muted border border-line hover:text-ink'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <AiButton
                    size="sm"
                    variant="secondary"
                    onClick={handleGenerateCaption}
                    loading={isGeneratingCaption}
                    disabled={isGeneratingCaption}
                  >
                    Generate Caption
                  </AiButton>
                  <AiButton
                    size="sm"
                    variant="outline"
                    onClick={handleSuggestHashtags}
                    loading={isSuggestingTags}
                    disabled={isSuggestingTags || !caption.trim()}
                  >
                    Suggest Tags
                  </AiButton>
                </div>
              </div>

              {/* Suggested Hashtag Chips */}
              {suggestedHashtags.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-line">
                  <span className="text-[10px] font-bold text-muted">Suggested Hashtags (tap to append):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedHashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddHashtag(tag)}
                        className="px-2 py-0.5 rounded-lg bg-card border border-line text-[10px] font-bold text-primary hover:bg-primary/10 transition cursor-pointer"
                      >
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reel Audio Track */}
          {activeType === 'reel' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Audio Name</label>
              <input
                type="text"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                placeholder="Original Audio or Track Title"
                className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-xs text-ink focus:outline-hidden focus:border-primary"
              />
            </div>
          )}

          {/* Location Input (posts & reels) */}
          {activeType !== 'story' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Location</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-canvas">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location (e.g. Mumbai, New York)"
                  className="w-full text-xs text-ink bg-transparent focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Settings Toggles */}
          <div className="pt-2 space-y-2 border-t border-line">
            {activeType !== 'story' ? (
              <label className="flex items-center justify-between text-xs text-ink font-semibold cursor-pointer">
                <span>Allow comments</span>
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded-sm cursor-pointer"
                />
              </label>
            ) : (
              <label className="flex items-center justify-between text-xs text-ink font-semibold cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-secondary" />
                  <span>Close Friends Only</span>
                </span>
                <input
                  type="checkbox"
                  checked={closeFriendsOnly}
                  onChange={(e) => setCloseFriendsOnly(e.target.checked)}
                  className="w-4 h-4 accent-secondary rounded-sm cursor-pointer"
                />
              </label>
            )}

            {/* Optional AI-Assisted tag */}
            {aiEnabled && (
              <label className="flex items-center justify-between text-xs text-ink font-semibold cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Add #AIAssisted tag</span>
                </span>
                <input
                  type="checkbox"
                  checked={isAiAssisted}
                  onChange={(e) => setIsAiAssisted(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded-sm cursor-pointer"
                />
              </label>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink">
                <span>Uploading to Cloudinary...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-line/40 overflow-hidden">
                <div
                  className="h-full bg-brand-gradient transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line flex items-center justify-between gap-3 bg-canvas">
          {isUploading ? (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="px-4 py-2 rounded-xl border border-rose-300 text-accent text-xs font-bold hover:bg-rose-500/10 transition cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-4 py-2 rounded-xl border border-line text-muted text-xs font-bold hover:bg-primary/10 transition cursor-pointer"
            >
              Discard
            </button>
          )}

          <button
            type="button"
            disabled={isUploading || selectedFiles.length === 0}
            onClick={() => handlePublish(false)}
            className="px-6 py-2.5 rounded-xl bg-brand-gradient text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Share {activeType === 'post' ? 'Post' : activeType === 'reel' ? 'Reel' : 'Story'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Moderation Review Warning Dialog */}
      <AnimatePresence>
        {moderationWarning && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl border border-rose-200/30 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-accent flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Safety Review Notice</h3>
                  <p className="text-[11px] text-muted">AI moderation feedback</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-accent">
                <p className="font-semibold">
                  {moderationWarning.reason || 'This caption might contain sensitive or controversial language.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModerationWarning(null)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink hover:bg-primary/10 transition cursor-pointer"
                >
                  Edit Caption
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish(true)}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-90 transition cursor-pointer"
                >
                  Post Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
