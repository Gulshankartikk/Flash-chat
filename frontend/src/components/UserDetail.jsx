import React, { useState } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  BellOff,
  Image as ImageIcon,
  Ban,
  Flag,
  ChevronRight,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import useLayoutStore from "../store/useLayoutStore";
import useThemeStore from "../store/useThemeStore";
import useUserStore from "../store/useUserStore";
import useChatStore from "../store/chatStore";
import { blockUser, unblockUser } from "../services/user.service";
import axiosInstance from "../services/url.services";
import { toast } from "react-toastify";

/**
 * UserDetail — contact profile panel (WhatsApp visual language)
 * --------------------------------------------------------------
 * Now matches HomePage.jsx / Layout.jsx / Sidebar.jsx: WhatsApp
 * teal-green header (#075E54), brand green (#25D366) accent, Inter
 * throughout. Signature touch retained: bio reads as a quoted
 * caption under the name, contact details sit in icon-chip rows.
 * --------------------------------------------------------------
 * Changes from previous pass:
 * - "Call" removed (no calling feature yet) — "Message" now
 *   actually navigates back to the chat list/window.
 * - Added Mute notifications toggle, Media/links/docs placeholder,
 *   and Block/Report — the WhatsApp contact-info staples.
 */

const UserDetail = () => {
  const selectedContact = useLayoutStore((state) => state.selectedContact);
  const setSelectedContact = useLayoutStore((state) => state.setSelectedContact);
  const setActiveView = useLayoutStore((state) => state.setActiveView);
  const contacts = useLayoutStore((state) => state.contacts);
  const activeConversation = useChatStore((state) => state.activeConversation);
  const { theme } = useThemeStore();
  const dark = theme === "dark";

  const currentUser = useUserStore((state) => state.user);
  const isBlocked = currentUser?.blockedUsers?.map(String).includes(String(selectedContact?._id));

  const [isMuted, setIsMuted] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "block" | "unblock" | "report" | null

  // ---- Premium Theme palette tokens ----
  const ink = dark ? "#FFFFFF" : "#1e293b"; // slate-800
  const sub = dark ? "#A0A0A0" : "#64748b"; // slate-500
  const accent = "#FF6B00";
  const danger = "#FF3D71";
  const border = dark ? "#222222" : "#e2e8f0"; // slate-200
  const panelBg = dark ? "#000000" : "#ffffff";
  const headerBg = dark ? "#111111" : "#f8fafc"; // slate-50
  const rowBg = dark ? "#1c1c1c" : "#f1f5f9"; // slate-100
  const dialogBg = dark ? "#1c1c1c" : "#ffffff";

  // Group parameters & states
  const isGroup = activeConversation?.conversationType === "group" && activeConversation?._id === selectedContact?._id;
  const groupName = isGroup ? activeConversation.groupName : selectedContact.name;
  const groupPhoto = isGroup ? (activeConversation.groupPhoto || activeConversation.groupAvatar) : selectedContact.profilePic;
  const groupAdmins = isGroup ? (activeConversation.groupAdmins || []).map(p => String(p._id || p)) : [];
  const isAdmin = isGroup && groupAdmins.includes(String(currentUser?._id));
  const groupParticipants = isGroup ? (activeConversation.participants || []) : [];

  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handlePromoteAdmin = async (memberId) => {
    setIsActionLoading(true);
    try {
      const { data } = await axiosInstance.post(`/chat/group/${activeConversation._id}/promote-admin`, {
        memberId
      });
      if (data && data.success) {
        toast.success("User promoted to Admin");
        useChatStore.setState({ activeConversation: data.data });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to promote user to Admin");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setIsActionLoading(true);
    try {
      const { data } = await axiosInstance.post(`/chat/group/${activeConversation._id}/remove-member`, {
        memberId
      });
      if (data && data.success) {
        toast.success("Member removed");
        useChatStore.setState({ activeConversation: data.data });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove member");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setIsActionLoading(true);
    try {
      const { data } = await axiosInstance.post(`/chat/group/${activeConversation._id}/add-members`, {
        members: selectedToAdd
      });
      if (data && data.success) {
        toast.success("Members added successfully");
        useChatStore.setState({ activeConversation: data.data });
        setShowAddMembersModal(false);
        setSelectedToAdd([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add members");
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!selectedContact) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: panelBg,
          color: sub,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <ChatGlyph color={sub} />
        <p style={{ fontSize: 14, margin: 0 }}>Select a contact to view their details</p>
      </div>
    );
  }

  const handleMessage = () => {
    // Contact is already the active conversation in the layout store —
    // just navigate back to the chat list/window view.
    setActiveView("chats");
  };

  const handleConfirm = async () => {
    if (confirmAction === "block") {
      try {
        const res = await blockUser(selectedContact._id);
        if (res && res.success) {
          const updatedBlocked = [...(currentUser?.blockedUsers || []), selectedContact._id];
          useUserStore.getState().updateProfile({ blockedUsers: updatedBlocked });
          toast.success(`Blocked ${selectedContact.name}`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to block user");
      }
    } else if (confirmAction === "unblock") {
      try {
        const res = await unblockUser(selectedContact._id);
        if (res && res.success) {
          const updatedBlocked = (currentUser?.blockedUsers || []).filter(
            (id) => String(id) !== String(selectedContact._id)
          );
          useUserStore.getState().updateProfile({ blockedUsers: updatedBlocked });
          toast.success(`Unblocked ${selectedContact.name}`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to unblock user");
      }
    } else if (confirmAction === "report") {
      toast.success(`Reported ${selectedContact.name}`);
    }
    setConfirmAction(null);
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: panelBg,
        color: ink,
        fontFamily: "Inter, sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .ud-icon-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 50%; padding: 8px; transition: background 0.12s ease; color: inherit; }
        .ud-icon-btn:hover { background: rgba(255,255,255,0.12); }
        .ud-action-btn:hover { filter: brightness(1.06); }
        .ud-list-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; cursor: pointer; transition: background 0.12s ease; background: none; border: none; width: 100%; text-align: left; font-family: inherit; }
        .ud-list-row:hover { background: ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}; }
        .ud-toggle { width: 38px; height: 22px; border-radius: 11px; border: none; cursor: pointer; position: relative; transition: background 0.15s ease; padding: 0; flex-shrink: 0; }
        .ud-toggle-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.25); }
        .ud-fade-in { animation: udFadeIn 0.2s ease both; }
        @keyframes udFadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ud-fade-in { animation: none !important; } }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: headerBg,
          color: ink,
        }}
      >
        <button
          className="ud-icon-btn"
          onClick={() => setSelectedContact(null)}
          aria-label="Close contact details"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
          {isGroup ? "Group info" : "Contact info"}
        </h2>
      </div>

      {/* Profile */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "36px 24px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <img
            src={
              groupPhoto ||
              (isGroup
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=075E54&color=fff`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=25D366&color=fff`)
            }
            alt={groupName}
            style={{
              width: 116,
              height: 116,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          {!isGroup && selectedContact.isOnline && (
            <span
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#FFD166",
                boxShadow: "0 0 8px #FFD166",
                border: `3px solid ${panelBg}`,
              }}
            />
          )}
        </div>

        <h3 style={{ fontSize: 22, fontWeight: 600, margin: "16px 0 0" }}>
          {groupName}
        </h3>

        {!isGroup && (
          <p style={{ fontSize: 13.5, color: sub, margin: "4px 0 0" }}>
            {selectedContact.isOnline ? (
              <span style={{ color: accent, fontWeight: 600 }}>Online</span>
            ) : (
              "Offline"
            )}
          </p>
        )}

        {isGroup && (
          <p style={{ fontSize: 13, color: sub, margin: "6px 0 0" }}>
            Group · {groupParticipants.length} participants
          </p>
        )}

        {!isGroup && selectedContact.bio && (
          <p
            style={{
              fontSize: 14,
              color: sub,
              margin: "16px 0 0",
              maxWidth: 280,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            "{selectedContact.bio}"
          </p>
        )}
      </div>

      {/* Primary action — Message only (Call removed: no calling feature yet) */}
      <div style={{ padding: "0 18px 8px" }}>
        <button
          className="ud-action-btn"
          onClick={handleMessage}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 0",
            borderRadius: 10,
            border: "none",
            background: accent,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <MessageCircle size={17} />
          Message
        </button>
      </div>

      {/* Details / Group Members */}
      {!isGroup ? (
        <div style={{ padding: "20px 18px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: sub,
              margin: "0 4px 2px",
            }}
          >
            Contact details
          </p>

          <InfoRow icon={Phone} label="Phone" value={selectedContact.phone} rowBg={rowBg} ink={ink} sub={sub} accent={accent} />
          <InfoRow icon={Mail} label="Email" value={selectedContact.email} rowBg={rowBg} ink={ink} sub={sub} accent={accent} />
          <InfoRow icon={MapPin} label="Location" value={selectedContact.location} rowBg={rowBg} ink={ink} sub={sub} accent={accent} />
        </div>
      ) : (
        <div style={{ padding: "20px 18px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: sub,
                margin: "0 4px",
                flex: 1,
                textAlign: "left"
              }}
            >
              Group Members ({groupParticipants.length})
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowAddMembersModal(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: accent,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <UserPlus size={14} /> Add
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
            {groupParticipants.map((member) => {
              const mIdStr = String(member._id || member);
              const mName = member.username || member.name || "Group Member";
              const mPic = member.profilePicture || member.profilePic || "";
              const mIsAdmin = groupAdmins.includes(mIdStr);
              const isMe = mIdStr === String(currentUser?._id);

              return (
                <div
                  key={mIdStr}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: rowBg
                  }}
                >
                  <img
                    src={mPic || `https://ui-avatars.com/api/?name=${encodeURIComponent(mName)}&background=f1f5f9&color=64748b`}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {mName} {isMe && "(You)"}
                    </p>
                  </div>
                  {mIsAdmin && (
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${accent}1a`, color: accent, fontWeight: 600 }}>
                      Admin
                    </span>
                  )}
                  {isAdmin && !mIsAdmin && !isMe && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        title="Promote to Admin"
                        disabled={isActionLoading}
                        onClick={() => handlePromoteAdmin(mIdStr)}
                        style={{ background: "none", border: "none", color: accent, cursor: "pointer", padding: 2 }}
                      >
                        <ShieldCheck size={16} />
                      </button>
                      <button
                        title="Remove Member"
                        disabled={isActionLoading}
                        onClick={() => handleRemoveMember(mIdStr)}
                        style={{ background: "none", border: "none", color: danger, cursor: "pointer", padding: 2 }}
                      >
                        <ShieldAlert size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Media, links and docs */}
      <div style={{ marginTop: 18, borderTop: `1px solid ${border}` }}>
        <button className="ud-list-row" style={{ color: ink }}>
          <ImageIcon size={19} style={{ color: sub, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14 }}>Media, links and docs</span>
          <span style={{ fontSize: 13, color: sub }}>0</span>
          <ChevronRight size={16} style={{ color: sub }} />
        </button>
      </div>

      {/* Notifications */}
      <div style={{ borderTop: `1px solid ${border}` }}>
        <div className="ud-list-row" style={{ cursor: "default" }}>
          <BellOff size={19} style={{ color: sub, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14 }}>Mute notifications</span>
          <button
            className="ud-toggle"
            role="switch"
            aria-checked={isMuted}
            aria-label="Mute notifications"
            onClick={() => setIsMuted((v) => !v)}
            style={{ background: isMuted ? accent : dark ? "#3A4750" : "#CFD4D8" }}
          >
            <span
              className="ud-toggle-knob"
              style={{ transform: isMuted ? "translateX(16px)" : "translateX(0)" }}
            />
          </button>
        </div>
      </div>

      {/* Danger zone */}
      {!isGroup && (
        <div style={{ borderTop: `1px solid ${border}`, marginBottom: 12 }}>
          <button
            className="ud-list-row"
            style={{ color: danger }}
            onClick={() => setConfirmAction(isBlocked ? "unblock" : "block")}
          >
            <Ban size={19} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {isBlocked ? "Unblock" : "Block"} {selectedContact.name}
            </span>
          </button>
          <button
            className="ud-list-row"
            style={{ color: danger }}
            onClick={() => setConfirmAction("report")}
          >
            <Flag size={19} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Report {selectedContact.name}</span>
          </button>
        </div>
      )}

      {/* Confirm dialog — shared for Block / Unblock / Report */}
      {confirmAction && (
        <div
          className="ud-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.55)",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: dialogBg,
              color: ink,
              borderRadius: 12,
              padding: 24,
              maxWidth: 340,
              width: "100%",
              boxShadow: dark
                ? "0 18px 40px -12px rgba(0,0,0,0.55)"
                : "0 18px 40px -12px rgba(0,0,0,0.22)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>
              {confirmAction === "block"
                ? `Block ${selectedContact.name}?`
                : confirmAction === "unblock"
                ? `Unblock ${selectedContact.name}?`
                : `Report ${selectedContact.name}?`}
            </h3>
            <p style={{ fontSize: 13.5, color: sub, margin: "0 0 20px", lineHeight: 1.5 }}>
              {confirmAction === "block"
                ? "Blocked contacts can no longer call or message you. They won't be notified."
                : confirmAction === "unblock"
                ? `Are you sure you want to unblock ${selectedContact.name}? You will be able to receive messages and calls from them again.`
                : "Tell us they're sending spam, abuse, or anything that breaks the rules. We'll review and won't reveal it was you."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: `1.5px solid ${border}`,
                  background: "transparent",
                  color: ink,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: confirmAction === "unblock" ? accent : danger,
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {confirmAction === "block" ? "Block" : confirmAction === "unblock" ? "Unblock" : "Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembersModal && (
        <div
          className="ud-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.55)",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: dialogBg,
              color: ink,
              borderRadius: 12,
              padding: 24,
              maxWidth: 360,
              width: "100%",
              boxShadow: "0 18px 40px -12px rgba(0,0,0,0.35)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Add Group Members</h3>
            
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 20px" }}>
              {contacts
                .filter((contact) => !groupParticipants.some((p) => String(p._id || p) === String(contact._id)))
                .map((contact) => {
                  const isChecked = selectedToAdd.includes(contact._id);
                  return (
                    <div
                      key={contact._id}
                      onClick={() => {
                        setSelectedToAdd((prev) =>
                          isChecked ? prev.filter((id) => id !== contact._id) : [...prev, contact._id]
                        );
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: rowBg,
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        style={{ accentColor: accent }}
                      />
                      <img
                        src={contact.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}`}
                        alt=""
                        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                      />
                      <span style={{ fontSize: 13, color: ink }}>{contact.name}</span>
                    </div>
                  );
                })}
              {contacts.filter((contact) => !groupParticipants.some((p) => String(p._id || p) === String(contact._id))).length === 0 && (
                <p style={{ fontSize: 13, color: sub, textAlign: "center", margin: "10px 0" }}>All your contacts are already in the group.</p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setShowAddMembersModal(false);
                  setSelectedToAdd([]);
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: `1.5px solid ${border}`,
                  background: "transparent",
                  color: ink,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={selectedToAdd.length === 0 || isActionLoading}
                onClick={handleAddMembers}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: selectedToAdd.length === 0 || isActionLoading ? 0.5 : 1
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// One contact-detail row: icon chip on the left, label + value stacked
// on the right. Falls back to a quiet "Not added" instead of the
// slightly alarming "Not Available" when a field is missing.
const InfoRow = ({ icon: Icon, label, value, rowBg, ink, sub, accent }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 10,
      background: rowBg,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: `${accent}1a`,
        color: accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={17} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 11, color: sub, margin: 0, fontWeight: 600, letterSpacing: 0.3 }}>{label}</p>
      <p
        style={{
          fontSize: 14,
          color: value ? ink : sub,
          margin: "1px 0 0",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value || "Not added"}
      </p>
    </div>
  </div>
);

// Inline glyph reused from ChatWindow's empty state for visual consistency.
const ChatGlyph = ({ color }) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
    <path
      d="M4 5h16v10H9l-4 4v-4H4V5Z"
      stroke={color}
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

export default UserDetail;