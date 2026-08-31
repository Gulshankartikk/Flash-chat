import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Phone, Video, Search, MoreVertical, ShieldAlert, Link2, LogOut, Users, Sparkles } from "lucide-react";
import StatusDot from "../status/StatusDot";
import axiosInstance from "../../services/url.services";
import AISummaryModal from "./AISummaryModal";
import { toast } from "react-toastify";

const ChatHeader = ({
  otherUser,
  conversation,
  isMobile,
  onBack,
  isTyping,
  onVoiceCall,
  onVideoCall,
  onSearchToggle,
  onBlockToggle,
  isBlocked,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const isGroup = conversation?.conversationType === "group";
  const name = isGroup
    ? (conversation?.groupName || "Group Chat")
    : (otherUser?.username || otherUser?.name || "Flash Chat User");
  const avatar = isGroup
    ? (conversation?.groupPhoto || conversation?.groupAvatar)
    : (otherUser?.profilePicture || otherUser?.profilePic);
  const isOnline = otherUser?.isOnline;
  const participantCount = conversation?.participants?.length || 0;

  const handleCopyInviteLink = async () => {
    if (!conversation?._id) return;
    try {
      const res = await axiosInstance.get(`/conversations/${conversation._id}/invite-link`);
      if (res?.data?.data?.inviteLink) {
        navigator.clipboard.writeText(res.data.data.inviteLink);
        toast.success("Group invite link copied to clipboard!");
      }
    } catch (err) {
      toast.error("Failed to generate group invite link");
    } finally {
      setMenuOpen(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!conversation?._id) return;
    if (!window.confirm(`Are you sure you want to leave ${name}?`)) return;
    try {
      await axiosInstance.post(`/conversations/${conversation._id}/leave`);
      toast.success("Left group successfully");
      if (onBack) onBack();
    } catch (err) {
      toast.error("Failed to leave group");
    } finally {
      setMenuOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] z-10 flex-shrink-0">
      {isMobile && (
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-slate-700 dark:hover:text-[#FFFFFF] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* Profile Pic & Status Ring */}
      <div className="relative">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            loading="lazy"
            decoding="async"
            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#222222]"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#FF6B00] text-[#FFFFFF] flex items-center justify-center font-bold text-sm">
            {isGroup ? <Users size={18} /> : name.charAt(0).toUpperCase()}
          </div>
        )}
        {!isGroup && (
          <div className="absolute -bottom-0.5 -right-0.5">
            <StatusDot isOnline={isOnline} size={10} />
          </div>
        )}
      </div>

      {/* Name and status message */}
      <div className="flex-1 text-left min-w-0">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">{name}</h3>
        <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] truncate font-medium">
          {isGroup ? (
            `${participantCount} members`
          ) : isTyping ? (
            <span className="text-[#FFD166] font-semibold">typing...</span>
          ) : isOnline ? (
            "Online"
          ) : (
            "Offline"
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsSummaryOpen(true)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-amber-500 hover:text-amber-400 transition-colors"
          title="Summarize Chat with Flash AI"
        >
          <Sparkles size={16} />
        </button>

        {!isGroup && (
          <>
            <button
              onClick={onVoiceCall}
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FFD166] transition-colors"
              title="Voice Call"
            >
              <Phone size={16} />
            </button>
            <button
              onClick={onVideoCall}
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FFD166] transition-colors"
              title="Video Call"
            >
              <Video size={16} />
            </button>
          </>
        )}
        <button
          onClick={onSearchToggle}
          className="p-2 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
          title="Search messages"
        >
          <Search size={16} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-slate-700 dark:hover:text-[#FFFFFF] transition-colors"
            title="Options"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-xl shadow-2xl py-1 w-44 z-20 text-left">
              <button
                onClick={() => {
                  setIsSummaryOpen(true);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-amber-500 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors w-full"
              >
                <Sparkles size={13} />
                Summarize with AI
              </button>

              {isGroup ? (
                <>
                  <button
                    onClick={handleCopyInviteLink}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#FF6B00] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <Link2 size={13} />
                    Copy Invite Link
                  </button>
                  <button
                    onClick={handleLeaveGroup}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <LogOut size={13} />
                    Leave Group
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (onBlockToggle) onBlockToggle();
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#FF9E00] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <ShieldAlert size={13} />
                    {isBlocked ? "Unblock Contact" : "Block Contact"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <AISummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        conversationId={conversation?._id}
      />
    </div>
  );
};

export default ChatHeader;


