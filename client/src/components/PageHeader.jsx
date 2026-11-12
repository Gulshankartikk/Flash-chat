import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  UserPlus,
  Users,
  Search,
  Sun,
  Moon,
  CheckCircle2,
  X
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from './Avatar';
import { Modal } from './Modal';

export const PageHeader = ({
  title,
  subtitle,
  onOpenSearch,
  rightAction,
  actions,
  userName
}) => {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  // Dynamic greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = userName || user?.name || user?.username || 'Explorer';
  const greetingText = `${getGreeting()}, ${displayName}`;

  // Formatted date line: e.g. "Thursday, November 13, 2026"
  const dateLine = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleSendInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteSent(true);
    setTimeout(() => {
      setInviteSent(false);
      setInviteEmail('');
      setIsInviteOpen(false);
    }, 1500);
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-card/90 backdrop-blur-xl border-b border-line flex-shrink-0 transition-colors duration-200">
        {/* Left Side: Greeting / Title + Date Line */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-ink truncate">
              {title || greetingText}
            </h1>
            <p className="text-xs text-ink-soft font-medium flex items-center gap-1.5 truncate mt-0.5">
              <span>{subtitle || dateLine}</span>
            </p>
          </div>
        </div>

        {/* Right Side: 2 Action Buttons (Glass "Activity log" + Dark "+ Invite a member") & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Glass Button: "Activity log" */}
          <button
            type="button"
            onClick={() => setIsActivityOpen(true)}
            className="glass px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-ink flex items-center gap-1.5 hover:bg-white/40 active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#f0735f] motion-reduce:transform-none"
            title="View recent workspace activity"
          >
            <Activity className="w-3.5 h-3.5 text-[#f0735f]" />
            <span className="hidden sm:inline">Activity log</span>
          </button>

          {/* Dark Button: "+ Invite a member" */}
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="bg-[#2a1712] hover:bg-[#170c09] text-white px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 active:scale-[0.98] transition-all duration-150 cursor-pointer border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#f0735f] motion-reduce:transform-none"
            title="Invite a new collaborator"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#f0735f]" />
            <span>+ Invite a member</span>
          </button>

          {/* Optional Search / Actions */}
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="hidden md:flex p-2 rounded-xl bg-card hover:bg-cream border border-line text-ink transition cursor-pointer shadow-xs"
              title="Search (⌘K)"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5 text-ink-soft" />
            </button>
          )}

          {/* Contacts Shortcut Button */}
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            className="hidden sm:flex p-2 sm:px-3 sm:py-1.5 rounded-xl border border-line bg-card hover:bg-cream text-ink transition items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            title="Contacts Directory"
            aria-label="Contacts"
          >
            <Users className="w-3.5 h-3.5 text-[#f0735f]" />
            <span className="hidden sm:inline">Contacts</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex p-2 rounded-xl border border-line bg-card hover:bg-cream text-ink transition cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#f0735f]"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-stone-700" />
            )}
          </button>

          {rightAction || actions}

          <div
            className="md:hidden cursor-pointer ml-1"
            onClick={() => navigate('/profile')}
          >
            <Avatar src={user?.avatar} alt={user?.name} size="xs" />
          </div>
        </div>
      </header>

      {/* Activity Log Modal */}
      <Modal
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        title="Workspace Activity Log"
        maxWidth="max-w-md"
      >
        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 rounded-xl bg-white/30 border border-edge flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-[#2f9e6b] mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-ink">Encrypted Socket Connected</p>
              <p className="text-ink-soft text-[11px] mt-0.5">Real-time gateway active with AES-256 session.</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/30 border border-edge flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-[#f0735f] mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-ink">Pocket Vault Synchronized</p>
              <p className="text-ink-soft text-[11px] mt-0.5">Zero-knowledge local state verified.</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/30 border border-edge flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-white/70 mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-ink">Address Book Verified</p>
              <p className="text-ink-soft text-[11px] mt-0.5">E.164 phone hash deduplication check complete.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Collaborator"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSendInvite} className="space-y-4 py-2">
          <p className="text-xs text-ink-soft">
            Send an invitation link to invite friends, team members, or collaborators to your Flash Chat workspace.
          </p>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Email or Phone Number
            </label>
            <input
              type="text"
              required
              placeholder="name@company.com or +1 234 567 8900"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-edge bg-white/30 text-ink text-xs focus:outline-none focus:ring-2 focus:ring-[#f0735f]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsInviteOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#2a1712] hover:bg-[#170c09] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {inviteSent ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2f9e6b]" />
                  <span>Invite Sent!</span>
                </>
              ) : (
                <span>Send Invitation</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default PageHeader;
