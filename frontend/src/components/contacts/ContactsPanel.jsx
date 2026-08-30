import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, UserPlus, UserCheck, UserX, MessageSquare,
  Clock, Shield, Users, ChevronRight, Loader2
} from "lucide-react";
import { toast } from "react-toastify";
import useChatStore from "../../store/chatStore";
import useLayoutStore from "../../store/useLayoutStore";
import { searchUsers } from "../../services/contact.service";
import StatusDot from "../status/StatusDot";

// ─── Avatar helper ───────────────────────────────────────────────────────────

const Avatar = ({ src, name, size = 11, online }) => {
  return (
    <div className="relative flex-shrink-0" style={{ width: size * 4, height: size * 4 }}>
      {src ? (
        <img
          src={src}
          alt={name}
          style={{ width: size * 4, height: size * 4 }}
          className="rounded-full object-cover border border-slate-200 dark:border-[#222222]"
        />
      ) : (
        <div
          style={{ width: size * 4, height: size * 4 }}
          className="rounded-full bg-gradient-to-br from-[#FF6B00] to-orange-400 text-white flex items-center justify-center font-bold text-sm border border-[#FF6B00]/20"
        >
          {(name || "?").charAt(0).toUpperCase()}
        </div>
      )}
      {online !== undefined && (
        <div className="absolute bottom-0 right-0">
          <StatusDot isOnline={online} size={10} />
        </div>
      )}
    </div>
  );
};

// ─── Tab: Contacts (accepted) ────────────────────────────────────────────────

const ContactsTab = ({ onStartChat }) => {
  const contactsList = useChatStore((s) => s.contactsList);
  const isLoadingContacts = useChatStore((s) => s.isLoadingContacts);
  const fetchContacts = useChatStore((s) => s.fetchContacts);
  const blockContact = useChatStore((s) => s.blockContact);
  const [query, setQuery] = useState("");
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = contactsList.filter((c) =>
    c.user?.username?.toLowerCase().includes(query.toLowerCase())
  );

  const handleBlock = async (c) => {
    if (actionId) return;
    setActionId(c._id);
    try {
      await blockContact(c._id);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-[#222222]">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#555555]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] focus:border-[#FF6B00] rounded-xl text-xs text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] focus:outline-none transition-colors"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoadingContacts ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={24} className="text-[#FF6B00] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center">
              <Users size={24} className="text-[#FF6B00]" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-[#FFFFFF]">
              {query ? "No contacts found" : "No contacts yet"}
            </p>
            <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">
              {query
                ? `No contact matches "${query}"`
                : "Search for people in the People tab and send contact requests."}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((c) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors group"
              >
                <Avatar src={c.user?.profilePicture} name={c.user?.username} size={11} online={c.user?.isOnline} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
                    {c.user?.username}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] truncate">
                    {c.user?.isOnline ? "Online" : (c.user?.about || "Hey there! I am using Flash Chat.")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onStartChat(c)}
                    className="p-2 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-all"
                    title="Start chat"
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    onClick={() => handleBlock(c)}
                    disabled={actionId === c._id}
                    className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                    title="Block contact"
                  >
                    {actionId === c._id ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                  </button>
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-300 dark:text-[#444] group-hover:text-[#FF6B00] transition-colors flex-shrink-0 ml-1 cursor-pointer"
                  onClick={() => onStartChat(c)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Requests (pending incoming) ───────────────────────────────────────

const RequestsTab = () => {
  const pendingRequests = useChatStore((s) => s.pendingRequests);
  const isLoadingRequests = useChatStore((s) => s.isLoadingRequests);
  const fetchPendingRequests = useChatStore((s) => s.fetchPendingRequests);
  const acceptContactRequest = useChatStore((s) => s.acceptContactRequest);
  const rejectContactRequest = useChatStore((s) => s.rejectContactRequest);
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    fetchPendingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = async (r) => {
    if (actionId) return;
    setActionId(`accept_${r._id}`);
    try {
      await acceptContactRequest(r._id);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (r) => {
    if (actionId) return;
    setActionId(`reject_${r._id}`);
    try {
      await rejectContactRequest(r._id);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {isLoadingRequests ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 size={24} className="text-[#FF6B00] animate-spin" />
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center">
            <UserCheck size={24} className="text-[#FF6B00]" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-[#FFFFFF]">No pending requests</p>
          <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">
            Contact requests you receive will appear here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 bg-[#FF6B00]/5 border-b border-slate-100 dark:border-[#222222]">
            <span className="text-[11px] font-bold text-[#FF6B00]">
              {pendingRequests.length} pending request{pendingRequests.length !== 1 ? "s" : ""}
            </span>
          </div>
          <AnimatePresence initial={false}>
            {pendingRequests.map((r) => (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-[#222222]"
              >
                <Avatar src={r.sender?.profilePicture} name={r.sender?.username} size={11} online={r.sender?.isOnline} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
                    {r.sender?.username}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> Wants to connect
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleAccept(r)}
                    disabled={!!actionId}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FF6B00] text-white text-[11px] font-bold hover:bg-[#E05E00] transition-all disabled:opacity-50 shadow-md shadow-[#FF6B00]/20"
                  >
                    {actionId === `accept_${r._id}` ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(r)}
                    disabled={!!actionId}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1c1c1c] text-slate-600 dark:text-[#A0A0A0] text-[11px] font-bold hover:bg-red-500/10 hover:text-red-500 transition-all disabled:opacity-50"
                  >
                    {actionId === `reject_${r._id}` ? <Loader2 size={12} className="animate-spin" /> : <UserX size={12} />}
                    Decline
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// ─── Tab: People (search & add) ──────────────────────────────────────────────

const PeopleTab = () => {
  const sendContactRequest = useChatStore((s) => s.sendContactRequest);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionMap, setActionMap] = useState({});
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    try {
      const res = await searchUsers(q);
      setResults(res?.data || []);
    } catch {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const handleSendRequest = async (user) => {
    if (actionMap[user._id]) return;
    setActionMap((m) => ({ ...m, [user._id]: "loading" }));
    try {
      await sendContactRequest(user._id);
      setActionMap((m) => ({ ...m, [user._id]: "sent" }));
    } catch {
      setActionMap((m) => ({ ...m, [user._id]: null }));
    }
  };

  const RelationshipButton = ({ user }) => {
    const state = actionMap[user._id] || user.relationshipStatus;
    if (state === "accepted") return (
      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
        <UserCheck size={12} /> Contact
      </span>
    );
    if (state === "request_sent" || state === "sent") return (
      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1c1c1c] text-slate-500 dark:text-[#A0A0A0] text-[11px] font-bold">
        <Clock size={12} /> Sent
      </span>
    );
    if (state === "pending_incoming") return (
      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
        <Clock size={12} /> Incoming
      </span>
    );
    if (state === "blocked") return (
      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 text-red-500 text-[11px] font-bold">
        <Shield size={12} /> Blocked
      </span>
    );
    if (state === "loading") return (
      <button disabled className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FF6B00] text-white text-[11px] font-bold opacity-70">
        <Loader2 size={12} className="animate-spin" /> Sending...
      </button>
    );
    return (
      <button
        onClick={() => handleSendRequest(user)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FF6B00] text-white text-[11px] font-bold hover:bg-[#E05E00] transition-all shadow-md shadow-[#FF6B00]/20"
      >
        <UserPlus size={12} /> Add
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-[#222222]">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#555555]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] focus:border-[#FF6B00] rounded-xl text-xs text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] focus:outline-none transition-colors"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={24} className="text-[#FF6B00] animate-spin" />
          </div>
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center">
              <Search size={24} className="text-[#FF6B00]" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-[#FFFFFF]">Find People</p>
            <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">
              Search by username, email or phone number to find and add contacts.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-[#FFFFFF]">No users found</p>
            <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">Try a different search term.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {results.map((user) => (
              <motion.div
                key={user._id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors"
              >
                <Avatar src={user.profilePicture} name={user.username} size={11} online={user.isOnline} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">{user.username}</p>
                  <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] truncate">{user.about || "Using Flash Chat"}</p>
                </div>
                <RelationshipButton user={user} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

// ─── Main ContactsPanel ──────────────────────────────────────────────────────

const TABS = [
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "requests", label: "Requests", icon: UserPlus },
  { id: "people",   label: "People",   icon: Search },
];

const ContactsPanel = () => {
  const [activeTab, setActiveTab] = useState("contacts");
  const pendingRequests = useChatStore((s) => s.pendingRequests);
  const contactsList = useChatStore((s) => s.contactsList);
  const startDirectConversation = useChatStore((s) => s.startDirectConversation);
  const fetchContacts = useChatStore((s) => s.fetchContacts);
  const fetchPendingRequests = useChatStore((s) => s.fetchPendingRequests);
  const setActiveView = useLayoutStore((s) => s.setActiveView);
  const setSelectedContact = useLayoutStore((s) => s.setSelectedContact);

  useEffect(() => {
    fetchContacts();
    fetchPendingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartChat = useCallback(async (contactRecord) => {
    try {
      const conversation = await startDirectConversation(
        contactRecord.user?._id || contactRecord._id
      );
      setSelectedContact({
        _id: conversation._id,
        name: contactRecord.user?.username || contactRecord.name || "",
        profilePic: contactRecord.user?.profilePicture || contactRecord.profilePic || "",
        isOnline: contactRecord.user?.isOnline || false,
        lastMessage: "",
        unreadCount: 0,
        _conv: conversation,
        otherUser: contactRecord.user,
      });
      setActiveView("chats");
    } catch {
      toast.error("Failed to open chat");
    }
  }, [startDirectConversation, setSelectedContact, setActiveView]);

  const requestBadge = pendingRequests.length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] px-4 pt-4 pb-0 sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-[#FFFFFF] mb-3">
          Contacts
        </h1>
        {/* Tabs */}
        <div className="flex">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge =
              tab.id === "requests"
                ? requestBadge
                : tab.id === "contacts"
                ? contactsList.length
                : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all flex-1 justify-center border-b-2 ${
                  isActive
                    ? "text-[#FF6B00] border-b-[#FF6B00]"
                    : "text-slate-400 dark:text-[#A0A0A0] border-b-transparent hover:text-slate-700 dark:hover:text-[#FFFFFF]"
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {badge > 0 && (
                  <span
                    className={`min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-1 ${
                      tab.id === "requests"
                        ? "bg-[#FF6B00] text-white animate-pulse"
                        : "bg-slate-200 dark:bg-[#222222] text-slate-500 dark:text-[#A0A0A0]"
                    }`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === "contacts" && <ContactsTab onStartChat={handleStartChat} />}
            {activeTab === "requests" && <RequestsTab />}
            {activeTab === "people"   && <PeopleTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ContactsPanel;
