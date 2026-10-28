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
  Lock,
  Bell,
  Download,
  Trash2,
  Users,
  HelpCircle,
  Palette,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Mail,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Switch } from '../../components/Switch';
import { UsageMeter } from '../ai';
import { AiProviderDisclosure } from '../../components/common/AiProviderDisclosure';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { isValidE164, formatToE164 } from '../contacts/phoneUtils';
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
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || user?.phone || '');
  const [phoneError, setPhoneError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: true, error: null });

  // Privacy Settings state
  const [privacy, setPrivacy] = useState({
    lastSeen: user?.privacy?.lastSeen || user?.privacySettings?.lastSeen || 'everyone',
    profilePhoto: user?.privacy?.profilePhoto || user?.privacySettings?.profilePhoto || 'everyone',
    readReceipts: user?.privacy?.readReceipts ?? user?.privacySettings?.readReceipts ?? true
  });
  const [isPrivateAccount, setIsPrivateAccount] = useState(
    user?.isPrivateAccount ?? user?.isPrivate ?? false
  );
  const [discoverableByPhone, setDiscoverableByPhone] = useState(
    user?.discoverableByPhone ?? true
  );
  const [discoverableByEmail, setDiscoverableByEmail] = useState(
    user?.discoverableByEmail ?? true
  );

  // AI Privacy & Permissions state
  const [aiSettings, setAiSettings] = useState({
    aiEnabled: user?.aiSettings?.aiEnabled ?? true,
    aiInChats: user?.aiSettings?.aiInChats ?? true,
    aiUsesPocket: user?.aiSettings?.aiUsesPocket ?? false
  });

  // Push notification modal state & PWA install
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const { canInstall, isInstalled, isIos, promptInstall } = usePwaInstall();

  // Active Sessions state
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || PRESET_AVATARS[0]);
      setPhoneNumber(user.phoneNumber || user.phone || '');
      setPrivacy({
        lastSeen: user.privacy?.lastSeen || user.privacySettings?.lastSeen || 'everyone',
        profilePhoto: user.privacy?.profilePhoto || user.privacySettings?.profilePhoto || 'everyone',
        readReceipts: user.privacy?.readReceipts ?? user.privacySettings?.readReceipts ?? true
      });
      setIsPrivateAccount(user.isPrivateAccount ?? user.isPrivate ?? false);
      setDiscoverableByPhone(user.discoverableByPhone ?? true);
      setDiscoverableByEmail(user.discoverableByEmail ?? true);
      setAiSettings({
        aiEnabled: user?.aiSettings?.aiEnabled ?? true,
        aiInChats: user?.aiSettings?.aiInChats ?? true,
        aiUsesPocket: user?.aiSettings?.aiUsesPocket ?? false
      });
    }
  }, [user]);

  // Debounced username availability checker
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || trimmed === user?.username?.toLowerCase()) {
      setUsernameStatus({ checking: false, available: true, error: null });
      return;
    }

    if (trimmed.length < 3 || !/^[a-z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: 'Must be 3-30 lowercase characters (letters, numbers, underscores)'
      });
      return;
    }

    setUsernameStatus({ checking: true, available: null, error: null });
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/check-username/${encodeURIComponent(trimmed)}`);
        if (res.data?.available) {
          setUsernameStatus({ checking: false, available: true, error: null });
        } else {
          setUsernameStatus({ checking: false, available: false, error: 'Username is already taken' });
        }
      } catch (err) {
        setUsernameStatus({
          checking: false,
          available: false,
          error: err.response?.data?.message || 'Error checking username'
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, user?.username]);

  // Fetch active sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      setIsLoadingSessions(true);
      try {
        const data = await getSessions();
        if (Array.isArray(data)) setSessions(data);
      } catch (err) {
        console.error('Failed to load active sessions', err);
      } finally {
        setIsLoadingSessions(false);
      }
    };
    loadSessions();
  }, [getSessions]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Display Name cannot be empty');
      return;
    }

    if (usernameStatus.error || usernameStatus.available === false) {
      toast.error('Please choose a valid and available username');
      return;
    }

    // Validate phone number if provided
    let normalizedPhone = null;
    if (phoneNumber && phoneNumber.trim()) {
      const raw = phoneNumber.trim();
      const formatted = raw.startsWith('+') ? raw : formatToE164(raw);
      if (!isValidE164(formatted)) {
        setPhoneError('Invalid phone number. Must be valid E.164 (e.g. +14155552671)');
        toast.error('Invalid phone number. Please include country code (e.g. +14155552671)');
        return;
      }
      normalizedPhone = formatted;
      setPhoneError(null);
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        username: username.trim(),
        bio: bio.trim(),
        about: bio.trim(),
        avatar,
        phoneNumber: normalizedPhone,
        phone: normalizedPhone,
        privacy,
        isPrivateAccount,
        discoverableByPhone,
        discoverableByEmail,
        aiSettings
      });
      toast.success('Profile and settings updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, WebP, or GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar file must be smaller than 5MB');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingAvatar(true);
    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.url) {
        setAvatar(res.data.url);
        setAvatarPreview(null);
        toast.success('Profile photo updated successfully!');
      } else {
        throw new Error('No URL returned from upload server');
      }
    } catch (err) {
      setAvatarPreview(null);
      toast.error(err.response?.data?.message || 'Failed to upload photo. Kept previous avatar.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => (s.id || s._id) !== sessionId));
      toast.success('Session revoked');
    } catch (err) {
      toast.error('Failed to revoke session');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error('Error logging out');
    }
  };

  const handleLogoutAll = async () => {
    const conf = window.confirm('Are you sure you want to sign out from all active devices?');
    if (!conf) return;
    try {
      await logoutAll();
      navigate('/login');
    } catch (err) {
      toast.error('Error logging out all sessions');
    }
  };

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <div className="flex-1 h-full overflow-y-auto bg-cream p-4 sm:p-6 lg:p-8 space-y-6 select-none">
      {/* Top Header Bar with Back Navigation & Social Link */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/chats')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-card border border-line text-xs font-bold text-ink hover:border-primary/50 transition cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-primary" />
          <span>Back to Chats</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-line text-[11px] font-bold text-ink shadow-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Active Now</span>
          </span>

          {user?.username && (
            <button
              type="button"
              onClick={() => navigate(`/u/${user.username}`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-card border border-line text-xs font-bold text-ink hover:text-primary transition cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>View Social Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Summary Card with WhatsApp & Instagram Presence */}
      <div className="bg-card rounded-3xl p-6 border border-line shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <Avatar
              src={avatarPreview || avatar}
              name={name}
              size="2xl"
              isOnline={true}
              showStatus
              className="shadow-lg shadow-primary/20 ring-4 ring-cream"
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <h2 className="text-xl font-black text-ink tracking-tight flex items-center justify-center sm:justify-start gap-1.5">
                <span>{name || 'Flash User'}</span>
                {user?.isVerified && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                    ✓
                  </span>
                )}
              </h2>
              {username && (
                <span className="text-xs font-bold text-muted bg-cream px-2.5 py-1 rounded-full border border-line self-center sm:self-auto">
                  @{username}
                </span>
              )}
            </div>

            <p className="text-xs text-ink/90 leading-relaxed italic max-w-lg">
              "{bio || '⚡ Hey there! I am using Flash Chat.'}"
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-[11px] text-muted">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Joined {joinedDate}</span>
              </div>
              {user?.phoneNumber && (
                <div className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                  <span>{user.phoneNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Social Stats Strip */}
          <div className="flex sm:flex-col items-center justify-around sm:justify-center gap-4 sm:gap-2 sm:border-l border-line sm:pl-6 w-full sm:w-auto text-center">
            <div className="flex-1 sm:flex-initial">
              <p className="text-base font-black text-ink">{user?.postsCount || 0}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Posts</p>
            </div>
            <div className="flex-1 sm:flex-initial">
              <p className="text-base font-black text-ink">{user?.followersCount || 0}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Followers</p>
            </div>
            <div className="flex-1 sm:flex-initial">
              <p className="text-base font-black text-ink">{user?.followingCount || 0}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Following</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => navigate('/contacts')}
          className="p-3.5 bg-card hover:bg-primary/10 border border-line rounded-2xl transition flex items-center gap-3 text-left shadow-xs group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-ink">My Contacts</p>
            <p className="text-[11px] text-muted">Manage address book</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/support')}
          className="p-3.5 bg-card hover:bg-primary/10 border border-line rounded-2xl transition flex items-center gap-3 text-left shadow-xs group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center group-hover:scale-105 transition-transform">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-ink">Help & Support</p>
            <p className="text-[11px] text-muted">Chat with support & FAQs</p>
          </div>
        </button>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => navigate('/dev/ui')}
            className="p-3.5 bg-card hover:bg-primary/10 border border-line rounded-2xl transition flex items-center gap-3 text-left shadow-xs group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">UI Styleguide</p>
              <p className="text-[11px] text-muted">Dev component showcase</p>
            </div>
          </button>
        )}
      </div>

      {/* Main Profile & Settings Form */}
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-line shadow-xs">
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          {/* Header */}
          <div className="border-b border-line/60 pb-4">
            <h2 className="text-xl font-black text-ink tracking-tight">
              Edit Profile & Account Settings
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Customize your persona, presence visibility, privacy controls, and AI features
            </p>
          </div>

          {/* Avatar selector & upload */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <Avatar
                src={avatarPreview || avatar}
                name={name}
                size="2xl"
                isOnline={true}
                showStatus
                className="shadow-lg shadow-primary/20"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 bg-ink/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer disabled:cursor-wait"
                title="Upload photo"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Change</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1">
              <p className="text-xs font-bold text-ink">Select a Preset Avatar or Upload Custom Photo</p>
              <p className="text-[11px] text-muted">Supported formats: JPEG, PNG, WebP (max 5MB)</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                {PRESET_AVATARS.map((seedUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatar(seedUrl);
                      setAvatarPreview(null);
                    }}
                    className={`w-10 h-10 rounded-full border-2 overflow-hidden transition cursor-pointer hover:scale-105 ${
                      avatar === seedUrl && !avatarPreview ? 'border-primary ring-2 ring-primary/30' : 'border-line'
                    }`}
                  >
                    <img src={seedUrl} alt="Avatar option" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Core Info Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
            <div>
              <Input
                label="Username (@handle) *"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                icon={<AtSign className="w-4 h-4 text-muted" />}
                required
              />
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                {usernameStatus.checking ? (
                  <span className="text-muted flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                  </span>
                ) : usernameStatus.error ? (
                  <span className="text-accent flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {usernameStatus.error}
                  </span>
                ) : usernameStatus.available && username.trim() !== user?.username ? (
                  <span className="text-primary flex items-center gap-1 font-semibold">
                    <Check className="w-3 h-3" /> @{username} is available
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Phone & Email Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Phone Number"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                placeholder="+14155552671"
                icon={<Smartphone className="w-4 h-4 text-muted" />}
              />
              <p className="text-[10px] text-muted mt-1">E.164 format with country code (e.g. +91, +1, +44)</p>
              {phoneError && (
                <p className="text-[11px] text-accent mt-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {phoneError}
                </p>
              )}
            </div>

            <div>
              <Input
                label="Email Address"
                value={user?.email || 'No email registered'}
                disabled
                placeholder="user@example.com"
                icon={<Mail className="w-4 h-4 text-muted" />}
              />
              <p className="text-[10px] text-muted mt-1">Primary sign-in and security recovery email</p>
            </div>
          </div>

          {/* About / Bio Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-ink">About & Bio</label>
              <span className="text-[10px] text-muted">{160 - bio.length} chars left</span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Write a short about or status quote..."
              rows={3}
              maxLength={160}
              className="w-full p-3 bg-cream border border-line rounded-2xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Privacy & Presence Settings (WhatsApp / Instagram style) */}
          <div className="pt-4 border-t border-line/60 space-y-4">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <span>Presence & Privacy Visibility</span>
            </h4>

            {/* Select Dropdowns for Last Seen & Profile Photo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-cream border border-line space-y-1.5">
                <label className="text-xs font-bold text-ink block">Last Seen & Online Presence</label>
                <p className="text-[11px] text-muted leading-tight">Control who sees when you were last online or active</p>
                <select
                  value={privacy.lastSeen}
                  onChange={(e) => setPrivacy({ ...privacy, lastSeen: e.target.value })}
                  className="w-full mt-1 p-2 bg-card border border-line rounded-xl text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-cream border border-line space-y-1.5">
                <label className="text-xs font-bold text-ink block">Profile Photo Visibility</label>
                <p className="text-[11px] text-muted leading-tight">Control who sees your profile avatar</p>
                <select
                  value={privacy.profilePhoto}
                  onChange={(e) => setPrivacy({ ...privacy, profilePhoto: e.target.value })}
                  className="w-full mt-1 p-2 bg-card border border-line rounded-xl text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Read Receipts (Blue Ticks)</p>
                  <p className="text-[11px] text-muted">Show other users when you have read their messages</p>
                </div>
                <Switch checked={privacy.readReceipts} onChange={(val) => setPrivacy({ ...privacy, readReceipts: val })} />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Private Social Account</p>
                  <p className="text-[11px] text-muted">Require approval for new followers before they view posts & stories</p>
                </div>
                <Switch checked={isPrivateAccount} onChange={setIsPrivateAccount} />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Discoverable by Phone</p>
                  <p className="text-[11px] text-muted">Allow contacts who have your phone number to find you on Flash Chat</p>
                </div>
                <Switch checked={discoverableByPhone} onChange={setDiscoverableByPhone} />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Discoverable by Email</p>
                  <p className="text-[11px] text-muted">Allow contacts who have your email to discover you on Flash Chat</p>
                </div>
                <Switch checked={discoverableByEmail} onChange={setDiscoverableByEmail} />
              </label>
            </div>
          </div>

          {/* Flash AI Features & Privacy */}
          <div className="pt-4 border-t border-line/60 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Flash AI Features & Privacy</span>
              </h4>
            </div>

            {/* Provider Disclosure */}
            <AiProviderDisclosure className="mb-2" />

            {/* Usage Meter */}
            <UsageMeter />

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Flash AI features</p>
                  <p className="text-[11px] text-muted">Access conversational assistant, smart tools, and multimodal vision</p>
                </div>
                <Switch
                  checked={aiSettings.aiEnabled}
                  onChange={(val) => setAiSettings({ ...aiSettings, aiEnabled: val })}
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Flash AI in chats</p>
                  <p className="text-[11px] text-muted">Enable 3-tap smart replies, message translation, thread summaries, and @ai mention bot</p>
                </div>
                <Switch
                  checked={aiSettings.aiInChats}
                  onChange={(val) => setAiSettings({ ...aiSettings, aiInChats: val })}
                  disabled={!aiSettings.aiEnabled}
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-line cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-ink">Flash AI can use my Pocket (Opt-in)</p>
                  <p className="text-[11px] text-muted">
                    Allows RAG question answering across your unencrypted saved Pocket items. Encrypted items are never accessed.
                  </p>
                </div>
                <Switch
                  checked={aiSettings.aiUsesPocket}
                  onChange={(val) => {
                    if (val) {
                      const agreed = window.confirm(
                        'Opting in allows Flash AI to query the top relevant unencrypted items in your Pocket when you ask questions. Encrypted items remain zero-knowledge locked and are never accessed. Do you wish to continue?'
                      );
                      if (agreed) setAiSettings({ ...aiSettings, aiUsesPocket: true });
                    } else {
                      setAiSettings({ ...aiSettings, aiUsesPocket: false });
                    }
                  }}
                  disabled={!aiSettings.aiEnabled}
                />
              </label>
            </div>
          </div>

          {/* Notifications & System Preferences */}
          <div className="pt-4 border-t border-line/60 space-y-3">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span>Notifications & Device Integration</span>
            </h4>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowNotificationModal(true)}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-cream border border-line hover:bg-primary/10 text-xs font-bold text-ink flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span>Push Notification Settings</span>
                </div>
                <span className="text-[11px] text-primary font-semibold">Configure &rarr;</span>
              </button>

              {!isInstalled && (canInstall || isIos) && (
                <button
                  type="button"
                  onClick={promptInstall}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-brand text-white hover:brightness-105 text-xs font-bold flex items-center justify-between shadow-sm transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-white" />
                    <span>Install Flash Chat App</span>
                  </div>
                  <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">PWA</span>
                </button>
              )}
            </div>
          </div>

          {/* Theme selector */}
          <div className="pt-4 border-t border-line/60 space-y-2">
            <label className="block text-xs font-bold text-ink">App Theme</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  theme === 'light'
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-line bg-card text-muted'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-line bg-card text-muted'
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
              variant="primary"
              isLoading={isSaving}
              disabled={isSaving || (usernameStatus.available === false)}
              className="w-full sm:w-auto px-6 py-2.5"
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Active Device Sessions & Account Actions */}
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-line shadow-xs space-y-5">
        <div className="border-b border-line/60 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink tracking-tight">
              Active Devices & Sessions
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Manage devices signed into your Flash Chat account
            </p>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/15 px-2.5 py-1 rounded-full">
            {sessions.length} Active
          </span>
        </div>

        {/* Sessions list */}
        <div className="space-y-2.5">
          {sessions.map((sess, idx) => {
            const sid = sess.id || sess._id;
            return (
              <div
                key={sid || idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-cream border border-line text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                    {sess.deviceInfo?.includes('Mobile') ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Laptop className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-ink">
                      {sess.deviceInfo?.slice(0, 32) || 'Current Web Session'}
                    </p>
                    <p className="text-[11px] text-muted">
                      Logged in {sess.createdAt ? new Date(sess.createdAt).toLocaleDateString() : 'Active now'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sess.isCurrent ? (
                    <span className="text-[10px] font-bold text-primary bg-cream border border-line px-2 py-0.5 rounded-full">
                      This Device
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sid)}
                      className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition cursor-pointer"
                      title="Sign out device"
                      aria-label="Sign out device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line/60">
          <Button
            type="button"
            variant="secondary"
            onClick={handleLogout}
            icon={<LogOut className="w-4 h-4 text-accent" />}
            className="w-full sm:w-auto text-accent hover:bg-accent/10"
          >
            Sign Out Current Device
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={handleLogoutAll}
            icon={<Shield className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Logout From All Devices
          </Button>
        </div>
      </div>

      <NotificationSettingsModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
    </div>
  );
};

export default ProfilePage;
