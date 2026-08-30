import React, { useState, useEffect } from "react";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import StatusDot from "../status/StatusDot";

const StatusTick = ({ status }) => {
  if (status === "sending") return <Clock size={10} className="text-[#A0A0A0]" aria-hidden="true" />;
  if (status === "failed") return <AlertCircle size={10} className="text-[#FF3D71]" aria-hidden="true" />;
  if (status === "sent") return <Check size={11} className="text-[#A0A0A0]" aria-hidden="true" />;
  if (status === "delivered") return <CheckCheck size={11} className="text-[#A0A0A0]" aria-hidden="true" />;
  if (status === "seen" || status === "read") return <CheckCheck size={11} className="text-[#FFD166]" aria-hidden="true" />;
  return null;
};

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ConversationItem = ({ item, isActive, onClick, currentUser }) => {
  const name = item.name || "Flash Chat User";
  const avatar = item.profilePic;
  const isOnline = item.isOnline;
  const lastMsg = item.lastMessage || "";
  const unreadCount = item.unread || 0;

  const [decryptedLastMsg, setDecryptedLastMsg] = useState(lastMsg);

  useEffect(() => {
    let active = true;
    const performDecryption = async () => {
      const convId = item._id || item.id;
      const otherUserId = item.otherUser?._id || item.otherUserId || item.id;
      const currentUserId = currentUser?._id;

      if (lastMsg.startsWith("e2ee:")) {
        const { decryptText } = await import("../../utils/crypto");
        const decrypted = await decryptText(lastMsg, convId, otherUserId, currentUserId);
        if (active) {
          setDecryptedLastMsg(decrypted);
        }
      } else {
        if (active) {
          setDecryptedLastMsg(lastMsg);
        }
      }
    };
    performDecryption();
    return () => {
      active = false;
    };
  }, [lastMsg, item._id, item.id, item.otherUser?._id, currentUser?._id]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  const summary = unreadCount > 0
    ? `${name}, ${unreadCount} unread message${unreadCount > 1 ? "s" : ""}, last message: ${decryptedLastMsg || "media"}`
    : `${name}, last message: ${decryptedLastMsg || "media"}`;

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-current={isActive ? "true" : undefined}
      aria-label={summary}
      className={`flex items-center gap-3 p-3.5 cursor-pointer border-b border-slate-200 dark:border-[#222222] transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40 focus-visible:ring-inset ${
        isActive
          ? "bg-slate-100 dark:bg-[#1c1c1c] border-l-4 border-[#FF6B00]"
          : "hover:bg-slate-50 dark:hover:bg-[#111111]/60 bg-transparent"
      }`}
    >
      {/* Avatar Container with live status */}
      <div className="relative flex-shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-[#222222]"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-800 dark:text-[#FFFFFF] flex items-center justify-center font-bold text-sm">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute bottom-0 right-0">
          <StatusDot isOnline={isOnline} size={10} />
        </div>
      </div>

      {/* Detail Block */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
            {name}
          </h4>
          {item.lastMessageTime && (
            <span className="text-[10px] text-slate-400 dark:text-[#A0A0A0] flex-shrink-0">
              {formatTime(item.lastMessageTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {item.lastMessageMine && <StatusTick status={item.lastMessageStatus} />}
          <p className="text-xs text-slate-400 dark:text-[#A0A0A0] truncate flex-1">
            {decryptedLastMsg}
          </p>
        </div>
      </div>

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span
          className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#FF9E00] text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-lg shadow-[#FF9E00]/20"
          style={{ animation: "unread-pop 0.3s ease-out" }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}

      <style>{`
        @keyframes unread-pop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ConversationItem;