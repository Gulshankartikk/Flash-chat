import React, { useState, useEffect, useRef, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MoreVertical, MessageSquarePlus, X,
  Check, CheckCheck, LogOut, Settings as SettingsIcon,
  Users as UsersIcon, Bell, Video, Phone, CircleDot,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import useChatStore from "../store/chatStore";
import useUserStore from "../store/useUserStore";
import useLayoutStore from "../store/useLayoutStore";
import useNotifications from "../hooks/useNotifications";
import NotificationPanel from "./notifications/NotificationPanel";
import { getAllUser } from "../services/user.service";
import StatusDot from "./status/StatusDot";
import { CallContext } from "../context/CallContext";
import axiosInstance from "../services/url.services";

const HomePage = () => {
  const navigate = useNavigate();
  const { startCall } = useContext(CallContext);

  // ── Chat store ──────────────────────────────────────────────────────────
  const conversations      = useChatStore((s) => s.conversations);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const openConversation   = useChatStore((s) => s.openConversation);
  const activeConversation = useChatStore((s) => s.activeConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const unreadCounts       = useChatStore((s) => s.unreadCounts);
  const isLoading          = useChatStore((s) => s.isLoadingConversations);

  // ── Layout store ────────────────────────────────────────────────────────
  const activeView         = useLayoutStore((s) => s.activeView);
  const setActiveView      = useLayoutStore((s) => s.setActiveView);
  const contacts           = useLayoutStore((s) => s.contacts);
  const setContacts        = useLayoutStore((s) => s.setContacts);
  const setSelectedContact = useLayoutStore((s) => s.setSelectedContact);

  // ── User store ──────────────────────────────────────────────────────────
  const currentUser = useUserStore((s) => s.user);
  const logout      = useUserStore((s) => s.logout);

  // ── Notifications ───────────────────────────────────────────────────────
  const {
    notifications, unreadCount: notifUnread,
    markAllAsRead, clearNotification,
  } = useNotifications();

  const [query, setQuery]               = useState("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [startingChatId, setStartingChatId]       = useState(null);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [notifPanelOpen, setNotifPanelOpen]       = useState(false);
  const menuRef = useRef(null);

  // Group creation state
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupPhotoFile, setGroupPhotoFile] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all users for the contacts list
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingContacts(true);
      try {
        const res = await getAllUser();
        const users = res?.data || [];
        const mapped = users.map((u) => ({
          _id:        u._id,
          name:       u.username || u.name || "Unknown",
          profilePic: u.profilePicture || "",
          isOnline:   u.isOnline || false,
          lastSeen:   u.lastSeen || null,
          phone:      u.phoneSuffix && u.phoneNumber
                        ? `${u.phoneSuffix} ${u.phoneNumber}`
                        : "",
          // keep the raw backend object so createConversation gets full data
          _raw: u,
        }));
        setContacts(mapped);
      } catch (err) {
        console.error("Failed to load contacts:", err);
        toast.error("Could not load contacts");
      } finally {
        setIsLoadingContacts(false);
      }
    };
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Build chat rows from conversations ──────────────────────────────────
  const chatRows = conversations.map((conv) => {
    const isGroup = conv.conversationType === "group";
    const other = isGroup ? null : conv.participants?.find((p) => p._id !== currentUser?._id);
    return {
      _id:               conv._id,
      name:              isGroup ? conv.groupName : (other?.username || other?.name || "Unknown"),
      profilePic:        isGroup ? (conv.groupPhoto || conv.groupAvatar || "") : (other?.profilePicture || ""),
      isOnline:          isGroup ? false : (other?.isOnline || false),
      lastSeen:          isGroup ? null : (other?.lastSeen || null),
      lastMessage:       conv.lastMessage?.content || conv.lastMessage?.message || "",
      lastMessageTime:   conv.updatedAt,
      lastMessageMine:
        conv.lastMessage?.sender === currentUser?._id ||
        conv.lastMessage?.sender?._id === currentUser?._id,
      lastMessageStatus: conv.lastMessage?.messageStatus || conv.lastMessage?.status || null,
      unreadCount:       unreadCounts[conv._id] || 0,
      _conv:             conv,
      otherUser:         other,
    };
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  // Click on an existing conversation row
  const handleChatClick = (row) => {
    openConversation(row._conv);
    setSelectedContact(row);
  };

  // Click on a contact to start / reopen a chat
  const handleStartChat = async (contact) => {
    if (startingChatId) return;
    setStartingChatId(contact._id);

    try {
      // Check if a real conversation already exists for this contact
      const existing = conversations.find((c) =>
        c.participants?.some((p) => p._id === contact._id)
      );

      if (existing) {
        // Reopen the existing conversation
        openConversation(existing);
        const other = existing.participants?.find((p) => p._id !== currentUser?._id);
        setSelectedContact({
          _id:        existing._id,
          name:       other?.username || other?.name || contact.name,
          profilePic: other?.profilePicture || contact.profilePic,
          isOnline:   other?.isOnline || contact.isOnline,
          lastMessage: existing.lastMessage?.content || "",
          unreadCount: 0,
          _conv:       existing,
          otherUser:   other,
        });
      } else {
        // ✅ BUG FIX: pass the full participant object, not just the id
        const participant = {
          _id:            contact._id,
          username:       contact.name,
          name:           contact.name,
          profilePicture: contact.profilePic,
          isOnline:       contact.isOnline,
          lastSeen:       contact.lastSeen,
        };
        const draftConv = createConversation(participant);

        setSelectedContact({
          _id:        draftConv._id,
          name:       contact.name,
          profilePic: contact.profilePic,
          isOnline:   contact.isOnline,
          lastMessage: "",
          unreadCount: 0,
          _conv:       draftConv,
          otherUser:   participant,
          isDraft:     true,
        });
      }

      setActiveView("chats");
    } catch (err) {
      console.error("Failed to start conversation:", err);
      toast.error("Could not open chat");
    } finally {
      setStartingChatId(null);
    }
  };

  // ── Filtering ───────────────────────────────────────────────────────────
  const isContactsView = activeView === "contacts";
  const baseRows       = isContactsView ? contacts : chatRows;
  const filteredRows   = baseRows.filter((c) =>
    c.name?.toLowerCase().includes(query.toLowerCase())
  );

  // ── Formatters ──────────────────────────────────────────────────────────
  const formatPreviewTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatLastSeen = (value) => {
    if (!value) return "offline";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "offline";
    const diff = Date.now() - date.getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  <  1) return "last seen just now";
    if (mins  < 60) return `last seen ${mins}m ago`;
    if (hours < 24) return `last seen ${hours}h ago`;
    return `last seen ${days}d ago`;
  };

  const StatusTick = ({ status }) => {
    if (!status) return null;
    if (status === "sent")
      return <Check size={13} className="text-[#A0A0A0] flex-shrink-0" />;
    if (status === "delivered")
      return <CheckCheck size={13} className="text-[#A0A0A0] flex-shrink-0" />;
    if (status === "seen" || status === "read")
      return <CheckCheck size={13} className="text-[#FFD166] flex-shrink-0" />;
    return null;
  };

  const activePeer = activeConversation?.participants?.find(
    (p) => p._id !== currentUser?._id
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans relative">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-[#FFFFFF]">
            {isContactsView ? "Select contact" : "Flash Chat"}
          </h1>

          <div className="flex items-center gap-1">
            <button
              onClick={() => document.getElementById("home-search-input")?.focus()}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
              title="Search"
            >
              <Search size={18} />
            </button>
            <button
              onClick={() => activePeer ? startCall(activePeer, "video") : toast.info("Select a conversation first")}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
              title="Video Call"
            >
              <Video size={18} />
            </button>
            <button
              onClick={() => activePeer ? startCall(activePeer, "voice") : toast.info("Select a conversation first")}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
              title="Voice Call"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={() => navigate("/status")}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
              title="Status"
            >
              <CircleDot size={18} />
            </button>
            <button
              onClick={() => setNotifPanelOpen(!notifPanelOpen)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF9E00] transition-colors relative"
              title="Notifications"
            >
              <Bell size={18} />
              {notifUnread > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#FF9E00] rounded-full animate-pulse border-2 border-white dark:border-[#111111]" />
              )}
            </button>
            <button
              onClick={() => navigate("/setting")}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#FFFFFF] transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-xl shadow-2xl py-1 w-44 z-20 text-left">
                  <button
                    onClick={() => { setActiveView("contacts"); setMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <UsersIcon size={14} /> Contacts List
                  </button>
                  <button
                    onClick={() => { setShowNewGroupModal(true); setMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <UsersIcon size={14} /> New Group
                  </button>
                  <button
                    onClick={() => { navigate("/setting"); setMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <SettingsIcon size={14} /> Settings
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); logout?.(); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#FF3D71] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#555555]" />
          <input
            id="home-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isContactsView ? "Search contacts..." : "Search conversations..."}
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] focus:border-[#FF6B00] rounded-xl text-xs text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] focus:outline-none transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#FFFFFF]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── List Body ── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#222222]">
        {/* Quick AI Assistant Shortcut */}
        {!isContactsView && !query && (
          <div
            onClick={async () => {
              const aiContact = contacts.find(c => c._raw?.isAIBot || c.name === "Flash AI");
              if (aiContact) {
                handleStartChat(aiContact);
              } else {
                // If not found in contacts yet, we can try to find it dynamically from raw list
                toast.info("Opening AI Assistant...");
                // Fallback: search contacts or show info
                const rawAI = contacts.find(c => c.name?.toLowerCase().includes("ai"));
                if (rawAI) handleStartChat(rawAI);
                else toast.error("AI Assistant not found. Please refresh.");
              }
            }}
            className="flex items-center gap-3.5 px-4 py-3.5 bg-gradient-to-r from-[#FF6B00]/10 to-purple-500/10 hover:from-[#FF6B00]/15 hover:to-purple-500/15 cursor-pointer border-b border-slate-100 dark:border-[#222222] transition-all group"
          >
            <div className="relative flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-tr from-[#FF6B00] to-purple-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-[#FF6B00]/10 group-hover:scale-105 transition-transform">
              🤖
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  Flash AI Chatbot
                </h4>
                <span className="text-[8px] bg-gradient-to-r from-[#FF6B00] to-purple-500 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  AI Assistant
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A0A0A0] mt-0.5">
                Ask questions, get help, or just have a conversation!
              </p>
            </div>
            <span className="text-[#FF6B00] text-lg font-bold group-hover:translate-x-1 transition-transform">›</span>
          </div>
        )}

        {(isLoading || (isContactsView && isLoadingContacts)) ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-20 text-center text-slate-400 dark:text-[#A0A0A0]">
            <p className="text-xs">
              {isContactsView
                ? "No contacts found. Make sure other users are registered."
                : "No conversations yet. Tap + to start a new chat!"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredRows.map((row) => {
              const isSelected =
                activeConversation?._id === row._conv?._id ||
                activeConversation?._id === row._id;
              const isStarting = startingChatId === row._id;

              return (
                <motion.div
                  key={row._id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() =>
                    isContactsView ? handleStartChat(row) : handleChatClick(row)
                  }
                  className={`flex items-center gap-3.5 px-4 py-3.5 cursor-pointer transition-all border-b border-slate-100 dark:border-[#222222] ${
                    isSelected
                      ? "bg-slate-100/70 dark:bg-[#1c1c1c] border-l-4 border-l-[#FF6B00]"
                      : "hover:bg-slate-50/50 dark:hover:bg-[#111111]/60"
                  } ${isStarting ? "opacity-60 pointer-events-none" : ""}`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {row.profilePic ? (
                      <img
                        src={row.profilePic}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-[#222222]"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] text-slate-700 dark:text-[#FFFFFF] flex items-center justify-center font-bold text-sm">
                        {row.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    {(!row._conv || row._conv.conversationType !== "group") && (
                      <div className="absolute bottom-0 right-0">
                        <StatusDot isOnline={row.isOnline} size={10} />
                      </div>
                    )}
                  </div>

                  {/* Text detail */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
                        {row.name}
                      </h4>
                      {!isContactsView && row.lastMessageTime && (
                        <span className="text-[10px] text-slate-400 dark:text-[#A0A0A0] flex-shrink-0">
                          {formatPreviewTime(row.lastMessageTime)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {!isContactsView && row.lastMessageMine && (
                          <StatusTick status={row.lastMessageStatus} />
                        )}
                        <p className="text-xs text-slate-400 dark:text-[#A0A0A0] truncate flex-1">
                          {isContactsView
                            ? (isStarting ? "Opening..." : "Tap to start chatting")
                            : (row.lastMessage || "No messages yet")}
                        </p>
                      </div>
                      {!row.isOnline && row.lastSeen && (
                        <span className="text-[9px] text-[#A0A0A0] flex-shrink-0 ml-1">
                          {formatLastSeen(row.lastSeen)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread badge */}
                  {!isContactsView && row.unreadCount > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#FF9E00] text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-lg shadow-[#FF9E00]/20 animate-pulse">
                      {row.unreadCount > 99 ? "99+" : row.unreadCount}
                    </span>
                  )}

                  {/* Loading spinner while opening */}
                  {isStarting && (
                    <div className="w-4 h-4 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── FAB: toggle chats / contacts ── */}
      <button
        onClick={() => setActiveView(isContactsView ? "chats" : "contacts")}
        className="absolute bottom-4 right-4 w-12 h-12 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center z-10"
        title={isContactsView ? "Back to chats" : "Start a new chat"}
      >
        {isContactsView ? <X size={20} /> : <MessageSquarePlus size={20} />}
      </button>

      {/* Group Creation Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-[#222222] flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#FF6B00] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Create New Group</h3>
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                  setGroupPhotoFile(null);
                  setGroupPhotoPreview("");
                }}
                className="text-white hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-[#333] flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#1c1c1c]">
                  {groupPhotoPreview ? (
                    <img src={groupPhotoPreview} alt="Group Preview" className="w-full h-full object-cover" />
                  ) : (
                    <UsersIcon size={28} className="text-slate-400 dark:text-[#555555]" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setGroupPhotoFile(file);
                        setGroupPhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-[#A0A0A0]">Upload Group Photo</span>
              </div>

              {/* Group Name */}
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-bold text-slate-500 dark:text-[#A0A0A0]">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Project Alpha"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] focus:border-[#FF6B00] rounded-xl text-xs text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] focus:outline-none transition-colors"
                />
              </div>

              {/* Search contacts to add */}
              <div className="flex flex-col gap-1 text-left flex-1">
                <label className="text-xs font-bold text-slate-500 dark:text-[#A0A0A0]">Select Members</label>
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#555555]" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] focus:border-[#FF6B00] rounded-xl text-xs text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] focus:outline-none transition-colors"
                  />
                </div>

                <div className="border border-slate-200 dark:border-[#222222] rounded-xl overflow-hidden max-h-48 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-[#222222]">
                  {contacts
                    .filter((c) => c.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                    .map((contact) => {
                      const isSelected = selectedMembers.includes(contact._id);
                      return (
                        <div
                          key={contact._id}
                          onClick={() => {
                            setSelectedMembers((prev) =>
                              isSelected ? prev.filter((id) => id !== contact._id) : [...prev, contact._id]
                            );
                          }}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1c1c1c] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded border-slate-300 dark:border-[#333] text-[#FF6B00] focus:ring-[#FF6B00] h-3.5 w-3.5"
                          />
                          {contact.profilePic ? (
                            <img src={contact.profilePic} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center font-bold text-xs">
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-slate-700 dark:text-[#FFFFFF] font-medium truncate">
                            {contact.name}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-[#222222] flex gap-3">
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                  setGroupPhotoFile(null);
                  setGroupPhotoPreview("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#1c1c1c] text-slate-700 dark:text-[#FFFFFF] text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!groupName.trim()) {
                    toast.error("Group name is required");
                    return;
                  }
                  if (selectedMembers.length === 0) {
                    toast.error("Select at least one member");
                    return;
                  }
                  setIsCreatingGroup(true);
                  try {
                    const formData = new FormData();
                    formData.append("groupName", groupName.trim());
                    formData.append("members", JSON.stringify(selectedMembers));
                    if (groupPhotoFile) {
                      formData.append("file", groupPhotoFile);
                    }
                    const { data } = await axiosInstance.post("/chat/group/create", formData, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                    if (data && data.success) {
                      toast.success("Group created successfully");
                      setShowNewGroupModal(false);
                      setGroupName("");
                      setSelectedMembers([]);
                      setGroupPhotoFile(null);
                      setGroupPhotoPreview("");

                      // Force refresh lists and activate the group chat
                      await fetchConversations();
                      openConversation(data.data);
                      setSelectedContact({
                        _id: data.data._id,
                        name: data.data.groupName,
                        profilePic: data.data.groupPhoto || "",
                        isOnline: false,
                        lastSeen: null,
                        lastMessage: "",
                        unreadCount: 0,
                        _conv: data.data,
                      });
                    }
                  } catch (err) {
                    console.error(err);
                    toast.error("Failed to create group");
                  } finally {
                    setIsCreatingGroup(false);
                  }
                }}
                disabled={isCreatingGroup}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isCreatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification panel */}
      <NotificationPanel
        isOpen={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={markAllAsRead}
        onClearNotification={clearNotification}
      />
    </div>
  );
};

export default HomePage;