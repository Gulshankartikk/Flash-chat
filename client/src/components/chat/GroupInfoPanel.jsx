import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Link as LinkIcon,
  Copy,
  Clock,
  LogOut,
  Camera,
  Check,
  AlertCircle
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { useToast } from '../Toast';
import api from '../../services/api';

export const GroupInfoPanel = ({
  conversation,
  currentUserId,
  isOpen,
  onClose,
  onUpdateConversation
}) => {
  const toast = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const [selectedDisappear, setSelectedDisappear] = useState(
    conversation?.disappearAfter || 0
  );
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  if (!isOpen || !conversation || conversation.type !== 'group') return null;

  const myMember = conversation.members.find((m) => String(m.user?._id || m.user) === String(currentUserId));
  const isAdmin = myMember?.role === 'admin';

  const inviteUrl = `${window.location.origin}/chats/join/${conversation.inviteCode || ''}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setIsCopied(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleResetInvite = async () => {
    try {
      const res = await api.post(`/chats/${conversation._id}/invite/reset`);
      toast.success('New invite link generated!');
      if (onUpdateConversation) {
        onUpdateConversation({ ...conversation, inviteCode: res.data.inviteCode });
      }
    } catch (err) {
      toast.error('Failed to reset invite link');
    }
  };

  const handleDisappearChange = async (seconds) => {
    setSelectedDisappear(seconds);
    setIsUpdatingSettings(true);
    try {
      await api.patch(`/chats/${conversation._id}`, { disappearAfter: seconds || null });
      toast.success(seconds ? `Disappearing messages set to ${seconds / 86400} days` : 'Disappearing messages turned off');
      if (onUpdateConversation) {
        onUpdateConversation({ ...conversation, disappearAfter: seconds || null });
      }
    } catch (err) {
      toast.error('Failed to update timer');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/chats/${conversation._id}/members/${userId}`);
      toast.success('Member removed');
      const updatedMembers = conversation.members.filter((m) => String(m.user?._id || m.user) !== String(userId));
      if (onUpdateConversation) {
        onUpdateConversation({ ...conversation, members: updatedMembers });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await api.patch(`/chats/${conversation._id}/members/${userId}/role`, { role: nextRole });
      toast.success(`Role updated to ${nextRole}`);
      const updatedMembers = conversation.members.map((m) =>
        String(m.user?._id || m.user) === String(userId) ? { ...m, role: nextRole } : m
      );
      if (onUpdateConversation) {
        onUpdateConversation({ ...conversation, members: updatedMembers });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await api.post(`/chats/${conversation._id}/leave`);
      toast.success('Left group');
      onClose();
      window.location.href = '/chats';
    } catch (err) {
      toast.error(err.message || 'Failed to leave group');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white border-l border-[#FED7AA] shadow-2xl flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="p-4 border-b border-[#FED7AA] flex items-center justify-between">
        <h3 className="font-bold text-base text-[#1F2937]">Group Info</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-50 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Group Banner & Avatar */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Avatar
            src={conversation.avatar}
            alt={conversation.name}
            size="2xl"
          />
          <h2 className="text-lg font-black text-[#1F2937] mt-2">
            {conversation.name}
          </h2>
          <p className="text-xs text-[#6B7280]">
            Group • {conversation.members?.length || 0} participants
          </p>
          {conversation.description && (
            <p className="text-xs text-[#6B7280] max-w-xs mt-1 italic">
              "{conversation.description}"
            </p>
          )}
        </div>

        {/* Invite Link Card */}
        <div className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Group Invite Link</span>
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleResetInvite}
                className="text-[10px] text-[#F97316] font-semibold hover:underline"
              >
                Reset link
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 text-[11px] p-2 bg-white rounded-xl border border-[#FED7AA] text-[#6B7280]"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyInvite}
              icon={isCopied ? Check : Copy}
            >
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Disappearing Messages Settings */}
        {isAdmin && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Disappearing Messages</span>
            </label>
            <select
              value={selectedDisappear}
              onChange={(e) => handleDisappearChange(Number(e.target.value))}
              disabled={isUpdatingSettings}
              className="w-full py-2 px-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs font-semibold text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              <option value={0}>Off</option>
              <option value={86400}>24 Hours</option>
              <option value={604800}>7 Days</option>
              <option value={7776000}>90 Days</option>
            </select>
          </div>
        )}

        {/* Participants List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#1F2937]">
            <span>Participants ({conversation.members?.length || 0})</span>
          </div>

          <div className="space-y-2">
            {conversation.members?.map((member, idx) => {
              const u = member.user;
              if (!u) return null;
              const isMemAdmin = member.role === 'admin';
              const isSelf = String(u._id || u) === String(currentUserId);

              return (
                <div
                  key={u._id || idx}
                  className="flex items-center justify-between p-2.5 rounded-2xl border border-[#FED7AA]/50 hover:bg-[#FFF7ED]/50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={u.avatar}
                      alt={u.name}
                      size="sm"
                      isOnline={u.isOnline}
                      showStatus
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1F2937] truncate">
                        {u.name || 'Member'} {isSelf && '(You)'}
                      </p>
                      <p className="text-[10px] text-[#6B7280] truncate">
                        @{u.username || 'user'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isMemAdmin && (
                      <span className="text-[10px] font-bold text-[#F97316] bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                        Admin
                      </span>
                    )}

                    {isAdmin && !isSelf && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u._id, member.role)}
                          className="p-1 text-[#6B7280] hover:text-[#F97316] rounded-md transition"
                          title={isMemAdmin ? 'Dismiss as admin' : 'Make group admin'}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(u._id)}
                          className="p-1 text-[#6B7280] hover:text-[#F43F5E] rounded-md transition"
                          title="Remove from group"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Group Action */}
        <div className="pt-4 border-t border-[#FED7AA]/60">
          <button
            type="button"
            onClick={handleLeaveGroup}
            className="w-full py-2.5 px-4 rounded-xl border border-rose-200 text-[#F43F5E] hover:bg-rose-50 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Group</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;
