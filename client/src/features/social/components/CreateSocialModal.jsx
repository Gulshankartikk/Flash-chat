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
import {
  createPostApi,
  createReelApi,
  createStoryApi,
  uploadMediaFile,
  searchUsersAndTagsApi
} from '../api/api';

export const CreateSocialModal = () => {
  const { isCreateModalOpen, closeCreateModal, createType: initialType } = useSocialStore();

  const [activeType, setActiveType] = useState('post'); // 'post' | 'reel' | 'story'
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, previewUrl, type, width, height, duration }
  const [cropAspect, setCropAspect] = useState('square'); // 'square' (1:1) | 'portrait' (4:5) | 'original'
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [audioName, setAudioName] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);

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

  // Final Publish Handler
  const handlePublish = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please choose media to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadError(null);

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

        if (uploadRes.success) {
          uploadedMedia.push({
            url: uploadRes.url,
            type: uploadRes.type || item.type,
            thumbnail: uploadRes.thumbnail || uploadRes.url,
            width: uploadRes.width,
            height: uploadRes.height,
            duration: uploadRes.duration
          });
        }
      }

      setUploadProgress(95);

      // 2. Dispatch to specific API endpoint
      if (activeType === 'post') {
        await createPostApi(
          {
            media: uploadedMedia,
            caption: caption.trim(),
            location: location.trim(),
            allowComments
          },
          null,
          abortControllerRef.current.signal
        );
      } else if (activeType === 'reel') {
        await createReelApi(
          {
            media: uploadedMedia[0],
            caption: caption.trim(),
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
            text: caption.trim(),
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
        setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
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
        className="w-full max-w-lg bg-white rounded-3xl border border-[#FED7AA] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#FED7AA]/60">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#1F2937]">Create New</h3>
            <div className="flex items-center gap-1 bg-[#FFF7ED] p-1 rounded-full border border-[#FED7AA]/60">
              <button
                type="button"
                onClick={() => {
                  setActiveType('post');
                  resetForm();
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeType === 'post'
                    ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-xs'
                    : 'text-[#6B7280]'
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
                    ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-xs'
                    : 'text-[#6B7280]'
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
                    ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white shadow-xs'
                    : 'text-[#6B7280]'
                }`}
              >
                Story
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCreateModal}
            className="p-1.5 rounded-full hover:bg-orange-50 text-[#6B7280] hover:text-[#1F2937] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {uploadError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-[#F43F5E] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Media Picker / Preview Canvas */}
          {selectedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video rounded-2xl border-2 border-dashed border-[#FED7AA] bg-[#FFF7ED]/50 hover:bg-[#FFF7ED] transition flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#FED7AA] flex items-center justify-center text-[#F97316] mb-2 group-hover:scale-110 transition shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-[#1F2937]">Click to upload media</p>
              <p className="text-[11px] text-[#6B7280] mt-1">
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
                  <span className="text-xs font-bold text-[#6B7280]">Ratio:</span>
                  <div className="flex items-center gap-1.5">
                    {['square', 'portrait', 'original'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCropAspect(mode)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition cursor-pointer ${
                          cropAspect === mode
                            ? 'bg-[#F97316] text-white shadow-xs'
                            : 'bg-[#FFF7ED] text-[#6B7280] hover:text-[#1F2937]'
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
            <label className="text-xs font-bold text-[#1F2937]">Caption</label>
            <textarea
              rows={3}
              value={caption}
              onChange={handleCaptionChange}
              placeholder={
                activeType === 'story'
                  ? 'Add text on story (optional)...'
                  : 'Write a caption with #hashtags and @mentions...'
              }
              className="w-full p-3 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs text-[#1F2937] placeholder-[#6B7280] focus:outline-hidden focus:border-[#F97316] transition"
            />

            {/* Autocomplete dropdown suggestions */}
            {autocompleteQuery && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-2xl border border-[#FED7AA] shadow-xl p-2 max-h-36 overflow-y-auto space-y-1">
                {autocompleteQuery.type === 'tag' &&
                  (autocompleteResults.tags?.length > 0 ? (
                    autocompleteResults.tags.map((tag) => (
                      <div
                        key={tag.tag}
                        onClick={() => handleApplyAutocomplete(tag.tag)}
                        className="p-1.5 rounded-xl hover:bg-orange-50 cursor-pointer flex items-center justify-between text-xs font-semibold text-[#1F2937]"
                      >
                        <span className="text-[#F97316]">#{tag.tag}</span>
                        <span className="text-[10px] text-[#6B7280]">{tag.count} posts</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#6B7280] p-1">No matching tags</p>
                  ))}

                {autocompleteQuery.type === 'user' &&
                  (autocompleteResults.users?.length > 0 ? (
                    autocompleteResults.users.map((u) => (
                      <div
                        key={u._id}
                        onClick={() => handleApplyAutocomplete(u.username)}
                        className="p-1.5 rounded-xl hover:bg-orange-50 cursor-pointer flex items-center gap-2 text-xs font-semibold text-[#1F2937]"
                      >
                        <span className="text-[#EC4899]">@{u.username}</span>
                        <span className="text-[10px] text-[#6B7280]">{u.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#6B7280] p-1">No matching users</p>
                  ))}
              </div>
            )}
          </div>

          {/* Reel Audio Track */}
          {activeType === 'reel' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#1F2937]">Audio Name</label>
              <input
                type="text"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                placeholder="Original Audio or Track Title"
                className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs text-[#1F2937] focus:outline-hidden focus:border-[#F97316]"
              />
            </div>
          )}

          {/* Location Input (posts & reels) */}
          {activeType !== 'story' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#1F2937]">Location</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30">
                <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location (e.g. Mumbai, New York)"
                  className="w-full text-xs text-[#1F2937] bg-transparent focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Settings Toggles */}
          <div className="pt-2 space-y-2 border-t border-[#FED7AA]/50">
            {activeType !== 'story' ? (
              <label className="flex items-center justify-between text-xs text-[#1F2937] font-semibold cursor-pointer">
                <span>Allow comments</span>
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="w-4 h-4 accent-[#F97316] rounded-sm cursor-pointer"
                />
              </label>
            ) : (
              <label className="flex items-center justify-between text-xs text-[#1F2937] font-semibold cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Close Friends Only</span>
                </span>
                <input
                  type="checkbox"
                  checked={closeFriendsOnly}
                  onChange={(e) => setCloseFriendsOnly(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded-sm cursor-pointer"
                />
              </label>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#1F2937]">
                <span>Uploading to Cloudinary...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#FED7AA]/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#F97316] to-[#EC4899] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#FED7AA]/60 flex items-center justify-between gap-3 bg-[#FFF7ED]/40">
          {isUploading ? (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="px-4 py-2 rounded-xl border border-rose-300 text-[#F43F5E] text-xs font-bold hover:bg-rose-50 transition cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-4 py-2 rounded-xl border border-[#FED7AA] text-[#6B7280] text-xs font-bold hover:bg-orange-50 transition cursor-pointer"
            >
              Discard
            </button>
          )}

          <button
            type="button"
            disabled={isUploading || selectedFiles.length === 0}
            onClick={handlePublish}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
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
    </div>
  );
};
