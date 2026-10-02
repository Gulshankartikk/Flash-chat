import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { Camera, Check, AlertCircle, Sparkles, User as UserIcon, AtSign, FileText } from 'lucide-react';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Flash',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Rocket',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Pixel',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum'
];

export const OnboardingPage = () => {
  const { user, completeOnboarding, isOnboarding, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username?.replace('user_', '') || '');
  const [bio, setBio] = useState(user?.bio || '⚡ Hey there! I am using Flash Chat.');
  const [avatar, setAvatar] = useState(user?.avatar || PRESET_AVATARS[0]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Username validation & availability check
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, error: null });

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    const trimmed = username.toLowerCase().trim();
    if (!trimmed) {
      setUsernameStatus({ checking: false, available: null, error: null });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: 'Must be 3-30 letters, numbers, or underscores'
      });
      return;
    }

    setUsernameStatus({ checking: true, available: null, error: null });
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username/${encodeURIComponent(trimmed)}`);
        setUsernameStatus({
          checking: false,
          available: res.data.available,
          error: res.data.available ? null : 'Username is already taken'
        });
      } catch {
        setUsernameStatus({ checking: false, available: null, error: 'Could not verify username' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.url) {
        setAvatar(res.data.url);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || usernameStatus.available === false) return;

    try {
      await completeOnboarding({
        name: name.trim(),
        username: username.toLowerCase().trim(),
        bio: bio.trim(),
        avatar
      });
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Onboarding submission error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FFF7ED]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl border border-[#FED7AA]"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white text-2xl font-black mb-3 shadow-lg shadow-orange-500/25">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1F2937]">
            Complete Your Profile
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Choose your username and avatar for Flash Chat & Social
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-[#F43F5E]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <img
                src={avatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-[#FED7AA] shadow-md bg-orange-50"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 p-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full shadow-md transition disabled:opacity-50"
                title="Upload Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            {isUploadingAvatar && (
              <span className="text-xs text-[#F97316] mt-2 animate-pulse font-medium">
                Uploading photo...
              </span>
            )}

            {/* Avatar presets */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">Presets:</span>
              <div className="flex gap-1.5">
                {PRESET_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`w-7 h-7 rounded-full border-2 overflow-hidden transition ${avatar === url ? 'border-[#F97316] scale-110' : 'border-transparent hover:border-orange-300'
                      }`}
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
              <input
                type="text"
                required
                maxLength={60}
                placeholder="e.g. Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1F2937]">
                Unique Username
              </label>
              {usernameStatus.checking && (
                <span className="text-[11px] text-[#F97316] animate-pulse">Checking...</span>
              )}
              {usernameStatus.available === true && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Available
                </span>
              )}
              {usernameStatus.error && (
                <span className="text-[11px] text-[#F43F5E] font-medium">
                  {usernameStatus.error}
                </span>
              )}
            </div>
            <div className="relative">
              <AtSign className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
              <input
                type="text"
                required
                maxLength={30}
                placeholder="alex_johnson"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${usernameStatus.available === true
                    ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20'
                    : usernameStatus.error
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                      : 'border-[#FED7AA] focus:ring-[#F97316] bg-[#FFF7ED]/30'
                  } text-[#1F2937]`}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1F2937]">
                Bio / About
              </label>
              <span className="text-[11px] text-[#6B7280]">{bio.length}/160</span>
            </div>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
              <textarea
                rows={2}
                maxLength={160}
                placeholder="Share a short bio..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isOnboarding || usernameStatus.available === false || !name.trim()}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isOnboarding ? 'Setting Up...' : 'Start Exploring Flash Chat'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingPage;
