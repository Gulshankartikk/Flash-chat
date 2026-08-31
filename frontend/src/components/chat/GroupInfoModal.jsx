import React, { useState, useEffect } from "react";
import { X, Users, Shield, UserMinus, Link2, Lock } from "lucide-react";
import axiosInstance from "../../services/url.services";
import { toast } from "react-toastify";

const GroupInfoModal = ({ isOpen, onClose, conversation, currentUser, onGroupUpdated }) => {
  const [activeTab, setActiveTab] = useState("members"); // "members" | "settings"
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(
    !!conversation?.onlyAdminsCanMessage
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversation) {
      setOnlyAdminsCanMessage(!!conversation.onlyAdminsCanMessage);
    }
  }, [conversation]);

  if (!isOpen || !conversation) return null;

  const participants = conversation.participants || [];
  const admins = conversation.groupAdmins || [];
  const isAdmin = admins.some((a) => String(a._id || a) === String(currentUser?._id));

  const handleFetchInviteLink = async () => {
    try {
      const res = await axiosInstance.get(`/conversations/${conversation._id}/invite-link`);
      if (res?.data?.data?.inviteLink) {
        navigator.clipboard.writeText(res.data.data.inviteLink);
        toast.success("Invite link copied to clipboard!");
      }
    } catch (err) {
      toast.error("Failed to generate group invite link");
    }
  };

  const handlePromoteAdmin = async (targetUserId) => {
    try {
      setLoading(true);
      const res = await axiosInstance.post(`/chat/group/${conversation._id}/promote-admin`, {
        userId: targetUserId,
      });
      toast.success("Member promoted to admin");
      if (onGroupUpdated) onGroupUpdated(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to promote admin");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      setLoading(true);
      const res = await axiosInstance.post(`/chat/group/${conversation._id}/remove-member`, {
        userId: targetUserId,
      });
      toast.success("Member removed from group");
      if (onGroupUpdated) onGroupUpdated(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermissions = async (newValue) => {
    try {
      setLoading(true);
      const res = await axiosInstance.patch(`/conversations/${conversation._id}/permissions`, {
        onlyAdminsCanMessage: newValue,
      });
      setOnlyAdminsCanMessage(newValue);
      toast.success("Group messaging permissions updated");
      if (onGroupUpdated) onGroupUpdated(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update permissions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#282828] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-[#282828] flex items-center justify-between bg-slate-50 dark:bg-[#111111]">
          <div className="flex items-center gap-3">
            {conversation.groupPhoto || conversation.groupAvatar ? (
              <img
                src={conversation.groupPhoto || conversation.groupAvatar}
                alt={conversation.groupName}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-[#282828]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-lg">
                <Users size={22} />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white truncate max-w-[220px]">
                {conversation.groupName || "Group Chat"}
              </h2>
              <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">
                {participants.length} participants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#282828] rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-[#282828] bg-slate-50 dark:bg-[#111111]">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === "members"
                ? "border-[#FF6B00] text-[#FF6B00]"
                : "border-transparent text-slate-400 dark:text-[#A0A0A0]"
            }`}
          >
            Members ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-[#FF6B00] text-[#FF6B00]"
                : "border-transparent text-slate-400 dark:text-[#A0A0A0]"
            }`}
          >
            Group Settings
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {activeTab === "members" ? (
            <div className="space-y-2">
              <button
                onClick={handleFetchInviteLink}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 text-[#FF6B00] rounded-xl text-xs font-semibold transition-colors mb-3"
              >
                <Link2 size={15} />
                Copy Group Invite Link
              </button>

              {participants.map((member) => {
                const memberId = String(member._id || member);
                const isMemberAdmin = admins.some((a) => String(a._id || a) === memberId);
                const isSelf = memberId === String(currentUser?._id);

                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-[#222222] rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member.profilePicture ? (
                        <img
                          src={member.profilePicture}
                          alt={member.username}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-[#282828]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-[#333333] text-slate-700 dark:text-white flex items-center justify-center font-bold text-xs">
                          {(member.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                            {member.username || member.name || "User"} {isSelf && "(You)"}
                          </p>
                          {isMemberAdmin && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-semibold border border-amber-500/20">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && !isSelf && (
                      <div className="flex items-center gap-1">
                        {!isMemberAdmin && (
                          <button
                            onClick={() => handlePromoteAdmin(memberId)}
                            disabled={loading}
                            className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Promote to Admin"
                          >
                            <Shield size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveMember(memberId)}
                          disabled={loading}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove Member"
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200 dark:border-[#282828] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock size={15} className="text-[#FF6B00]" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                        Restricted Messaging
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] leading-snug">
                      When enabled, only group admins can send messages into this chat room.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isAdmin || loading}
                    checked={onlyAdminsCanMessage}
                    onChange={(e) => handleTogglePermissions(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FF6B00] focus:ring-[#FF6B00] mt-1 cursor-pointer"
                  />
                </div>
              </div>

              {!isAdmin && (
                <p className="text-[11px] text-slate-400 dark:text-[#888888] italic text-center">
                  Only group admins can modify group settings.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
