import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  AtSign,
  FileText,
  Camera,
  Shield,
  Eye,
  Check,
  AlertCircle,
  LogOut,
  Smartphone,
  Laptop,
  Globe,
  Sun,
  Moon,
  Sparkles,
  Lock
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import api from '../../services/api';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Flash',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Rocket',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Pixel',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum'
];

export const ProfilePage = () => {
  const { user, updateProfile, logout, logoutAll, getSessions } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || PRESET_AVATARS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, error: null });

  // Privacy Settings state
  const [privacy, setPrivacy] = useState({
    lastSeen: user?.privacy?.lastSeen || user?.privacySettings?.lastSeen || 'everyone',
    profilePhoto: user?.privacy?.profilePhoto || user?.privacySettings?.profilePhoto || 'everyone',
    readReceipts: user?.privacy?.readReceipts ?? user?.privacySettings?.readReceipts ?? true
  });
  const [isPrivateAccount, setIsPrivateAccount] = useState(
    user?.isPrivateAccount ?? user?.isPrivate ?? false
  );

  // Active Sessions state
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || PRESET_AVATARS[0]);
      setPrivacy({
        lastSeen: user.privacy?.lastSeen || user.privacySettings?.lastSeen || 'everyone',
        profilePhoto: user.privacy?.profilePhoto || user.privacySettings?.profilePhoto || 'everyone',
        readReceipts: user.privacy?.readReceipts ?? user.privacySettings?.readReceipts ?? true
      });
      setIsPrivateAccount(user.isPrivateAccount ?? user.isPrivate ?? false);
    }
  }, [user]);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      setIsLoadingSessions(true);
      const list = await getSessions();
      setSessions(list);
      setIsLoadingSessions(false);
    };
    loadSessions();
  }, [getSessions]);

  // Live debounced username checking if changed
  useEffect(() => {
    const trimmed = username.toLowerCase().trim();
    if (!trimmed || trimmed === user?.username) {
      setUsernameStatus({ checking: false, available: null, error: null });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: '3-30 alphanumeric characters & underscores only'
      });
      return;
    }

    setUsernameStatus({ checking: true, available: null, error: null });
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/check-username/${encodeURIComponent(trimmed)}`);
        setUsernameStatus({
          checking: false,
          available: res.data.available,
          error: res.data.available ? null : 'Username taken'
        });
      } catch {
        setUsernameStatus({ checking: false, available: null, error: 'Check failed' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, user?.username]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.url) {
        setAvatar(res.data.url);
        toast.success('Avatar uploaded successfully!');
      }
    } catch (err) {
      toast.error(err.message || 'Avatar upload failed');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || usernameStatus.available === false) return;

    setIsSaving(true);
    try {
      const res = await api.patch('/users/me', {
        name: name.trim(),
        username: username.toLowerCase().trim(),
        bio: bio.trim(),
        avatar,
        privacy,
        isPrivateAccount
      });

      if (res.data?.user) {
        updateProfile(res.data.user);
        toast.success('Profile and settings updated!');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    try {
      await api.patch('/users/me', { theme: newTheme });
    } catch {
      // Local theme is already applied
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      {/* Profile Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with upload badge */}
          <div className="relative group">
            <Avatar
              src={avatar}
              alt={name}
              size="2xl"
              isOnline={user?.isOnline}
              showStatus
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute bottom-1 right-1 p-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full shadow-lg transition cursor-pointer"
              title="Upload new avatar"
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

          {/* User Info Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-2xl font-black text-[#1F2937] tracking-tight">
                {name || 'Flash User'}
              </h2>
              <span className="self-center sm:self-auto text-xs font-bold text-[#F97316] bg-orange-100 px-2.5 py-0.5 rounded-full border border-[#FED7AA]">
                @{username || 'handle'}
              </span>
            </div>

            <p className="text-sm text-[#6B7280] max-w-xl">
              {bio || '⚡ Hey there! I am using Flash Chat.'}
            </p>

            {/* Counters */}
            <div className="pt-2 flex items-center justify-center sm:justify-start gap-6 text-xs text-[#1F2937]">
              <div>
                <span className="font-black text-sm">{user?.followersCount || 0}</span>{' '}
                <span className="text-[#6B7280]">Followers</span>
              </div>
              <div>
                <span className="font-black text-sm">{user?.followingCount || 0}</span>{' '}
                <span className="text-[#6B7280]">Following</span>
              </div>
              <div>
                <span className="font-black text-sm">{user?.postsCount || 0}</span>{' '}
                <span className="text-[#6B7280]">Posts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preset avatar choices */}
        <div className="mt-6 pt-5 border-t border-[#FED7AA]/50 flex items-center gap-3">
          <span className="text-xs font-semibold text-[#6B7280]">Choose Avatar:</span>
          <div className="flex gap-2">
            {PRESET_AVATARS.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAvatar(url)}
                className={`w-8 h-8 rounded-full border-2 overflow-hidden transition cursor-pointer ${
                  avatar === url ? 'border-[#F97316] scale-110 shadow-sm' : 'border-transparent hover:border-orange-300'
                }`}
              >
                <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Edit Profile Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm space-y-6">
        <div className="border-b border-[#FED7AA]/50 pb-4">
          <h3 className="text-lg font-bold text-[#1F2937] tracking-tight">
            Edit Identity & Profile
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Your name and username are shared across Chats, Social, and Pocket
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">
                  Username
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                    usernameStatus.available === true
                      ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20'
                      : usernameStatus.error
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                      : 'border-[#FED7AA] focus:ring-[#F97316] bg-[#FFF7ED]/30'
                  } text-[#1F2937]`}
                />
              </div>
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
                rows={3}
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              />
            </div>
          </div>

          {/* Privacy Controls Section */}
          <div className="pt-4 border-t border-[#FED7AA]/50 space-y-4">
            <h4 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#F97316]" />
              <span>Privacy & Security</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                  Who can see my Last Seen
                </label>
                <select
                  value={privacy.lastSeen}
                  onChange={(e) => setPrivacy({ ...privacy, lastSeen: e.target.value })}
                  className="w-full py-2.5 px-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs font-semibold text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts Only</option>
                  <option value="nobody">Nobody (Hidden)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                  Who can see my Profile Photo
                </label>
                <select
                  value={privacy.profilePhoto}
                  onChange={(e) => setPrivacy({ ...privacy, profilePhoto: e.target.value })}
                  className="w-full py-2.5 px-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs font-semibold text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts Only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
            </div>

            {/* Read Receipts & Private Account toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF7ED]/50 border border-[#FED7AA] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#1F2937]">Read Receipts (Blue Ticks)</p>
                  <p className="text-[11px] text-[#6B7280]">Show other users when you have read their messages</p>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.readReceipts}
                  onChange={(e) => setPrivacy({ ...privacy, readReceipts: e.target.checked })}
                  className="w-4 h-4 text-[#F97316] rounded border-[#FED7AA] focus:ring-[#F97316] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF7ED]/50 border border-[#FED7AA] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#1F2937]">Private Social Account</p>
                  <p className="text-[11px] text-[#6B7280]">Require approval for new followers before they view posts & stories</p>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivateAccount}
                  onChange={(e) => setIsPrivateAccount(e.target.checked)}
                  className="w-4 h-4 text-[#F97316] rounded border-[#FED7AA] focus:ring-[#F97316] cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Theme selector */}
          <div className="pt-4 border-t border-[#FED7AA]/50 space-y-2">
            <label className="block text-xs font-semibold text-[#1F2937]">
              App Theme
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  theme === 'light'
                    ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                    : 'border-[#FED7AA] bg-white text-[#6B7280]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                    : 'border-[#FED7AA] bg-white text-[#6B7280]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              isLoading={isSaving}
              disabled={usernameStatus.available === false || !name.trim()}
              className="w-full sm:w-auto px-6 py-2.5"
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Active Device Sessions & Account Actions */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FED7AA] shadow-sm space-y-5">
        <div className="border-b border-[#FED7AA]/50 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1F2937] tracking-tight">
              Active Devices & Sessions
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Manage devices signed into your Flash Chat account
            </p>
          </div>
          <span className="text-xs font-semibold text-[#F97316] bg-orange-100 px-2.5 py-1 rounded-full">
            {sessions.length} Active
          </span>
        </div>

        {/* Sessions list */}
        <div className="space-y-2.5">
          {sessions.map((sess, idx) => (
            <div
              key={sess.id || idx}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF7ED]/40 border border-[#FED7AA]/60 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-[#F97316]">
                  {sess.deviceInfo?.includes('Mobile') ? (
                    <Smartphone className="w-4 h-4" />
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-[#1F2937]">
                    {sess.deviceInfo?.slice(0, 32) || 'Current Web Session'}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    Logged in {new Date(sess.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {sess.isCurrent && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  This Device
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#FED7AA]/50">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Current Device</span>
          </button>

          <button
            type="button"
            onClick={handleLogoutAll}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            <span>Logout From All Devices</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
