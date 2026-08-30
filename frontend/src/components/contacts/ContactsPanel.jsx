import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, UserPlus, UserCheck, UserX, MessageSquare,
  Clock, Shield, Users, ChevronRight, Loader2
} from "lucide-react";
import { toast } from "react-toastify";
import useChatStore from "../../store/chatStore";
import useUserStore from "../../store/useUserStore";
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

const RelationshipButton = ({ user, actionState, onSendRequest }) => {
  const state = actionState || user?.relationshipStatus;
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
      onClick={() => onSendRequest(user)}
      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FF6B00] text-white text-[11px] font-bold hover:bg-[#E05E00] transition-all shadow-md shadow-[#FF6B00]/20"
    >
      <UserPlus size={12} /> Add Contact
    </button>
  );
};

// ─── Add Contact Modal ───────────────────────────────────────────────────────

const AddContactModal = ({ isOpen, onClose, onContactAdded }) => {
  const addContactManually = useChatStore((s) => s.addContactManually);
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter a mobile number or Flash ID.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const res = await addContactManually(identifier.trim(), name.trim());
      setSuccessResult(res);
      if (onContactAdded && res?.contact) {
        onContactAdded(res.contact);
      }
    } catch (err) {
      setError(err.message || "Failed to add contact.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartChatNow = () => {
    if (successResult?.contact && onContactAdded) {
      onContactAdded(successResult.contact, true);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#282828] rounded-3xl shadow-2xl p-6 space-y-5 text-left relative"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00]">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Add New Contact</h3>
              <p className="text-xs text-slate-400">Search by Mobile Number or Flash ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {successResult ? (
          <div className="space-y-4 py-2 text-center animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <UserCheck size={28} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                {successResult.user?.displayName || successResult.user?.username || "Contact Added"}
              </h4>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                Contact added successfully to your list!
              </p>
              {successResult.user?.flashId && (
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  ⚡ Flash ID: {successResult.user.flashId}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartChatNow}
                className="flex-1 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E05E00] text-xs font-bold text-white transition-all shadow-md shadow-[#FF6B00]/20 flex items-center justify-center gap-1.5"
              >
                <MessageSquare size={14} /> Start Chat
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mobile Number or Flash ID <span className="text-[#FF6B00]">*</span>
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. +91 9876543210 or FC-7K29X8"
                autoFocus
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#282828] text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#FF6B00] transition-colors"
              />
              <p className="text-[10px] text-slate-400">
                Enter full phone number with country code (e.g. +91) or the user's Flash ID.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Contact Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#282828] text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#FF6B00] transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="flex-1 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E05E00] text-xs font-bold text-white transition-all shadow-md shadow-[#FF6B00]/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <UserPlus size={14} /> Add Contact
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Contacts (accepted) ────────────────────────────────────────────────

const ContactsTab = ({ onStartChat, onOpenAddModal }) => {
  const contactsList = useChatStore((s) => s.contactsList);
  const isLoadingContacts = useChatStore((s) => s.isLoadingContacts);
  const fetchContacts = useChatStore((s) => s.fetchContacts);
  const blockContact = useChatStore((s) => s.blockContact);
  const deleteContact = useChatStore((s) => s.deleteContact);
  const [query, setQuery] = useState("");
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = contactsList.filter((c) =>
    (c.user?.displayName || c.user?.username || "")
      .toLowerCase()
      .includes(query.toLowerCase())
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

  const handleDelete = async (c) => {
    if (actionId) return;
    if (!window.confirm(`Remove ${c.user?.displayName || c.user?.username} from your contacts?`)) return;
    setActionId(c._id);
    try {
      await deleteContact(c._id);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Search & Add Contact Button Row */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-[#222222] flex items-center gap-2">
        <div className="relative flex-1">
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
        <button
          onClick={onOpenAddModal}
          className="h-8 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#FF6B00]/20 transition-all shrink-0"
          title="Manually Add Contact"
        >
          <UserPlus size={13} />
          <span>Add</span>
        </button>
      </div>

      {/* Action Banner: New Contact Item */}
      <button
        onClick={onOpenAddModal}
        className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors text-left group"
      >
        <div className="w-11 h-11 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] group-hover:bg-[#FF6B00] group-hover:text-white flex items-center justify-center transition-colors">
          <UserPlus size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-[#FFFFFF]">New Contact</p>
          <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0]">Add contact by mobile number or Flash ID</p>
        </div>
        <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </button>

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
                : "Add friends by mobile number or Flash ID to start chatting."}
            </p>
            {!query && (
              <button
                onClick={onOpenAddModal}
                className="mt-2 px-4 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] transition-all shadow-md shadow-[#FF6B00]/20 flex items-center gap-1.5"
              >
                <UserPlus size={14} /> Add Your First Contact
              </button>
            )}
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
                <Avatar src={c.user?.profilePicture} name={c.user?.displayName || c.user?.username} size={11} online={c.user?.isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
                      {c.user?.displayName || c.user?.username}
                    </p>
                    {c.user?.flashId && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                        {c.user.flashId}
                      </span>
                    )}
                  </div>
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
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-400 hover:text-amber-500 transition-colors"
                    title="Block Contact"
                  >
                    <Shield size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={actionId === c._id}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove Contact"
                  >
                    <UserX size={14} />
                  </button>
                </div>
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
  const currentUser = useUserStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionMap, setActionMap] = useState({});
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef(null);

  const myFlashId = currentUser?.flashId || (currentUser?._id ? `FC-${currentUser._id.slice(-6).toUpperCase()}` : "FC-FLASH");

  const copyMyFlashId = () => {
    navigator.clipboard?.writeText(myFlashId);
    setCopied(true);
    toast.success("Flash ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

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
      toast.success(`Contact request sent to ${user.displayName || user.username}!`);
    } catch {
      setActionMap((m) => ({ ...m, [user._id]: null }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* My Flash ID banner */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-400">⚡ Your Flash ID:</span>
          <span className="font-mono font-bold text-xs text-slate-100 bg-slate-900/60 px-2 py-0.5 rounded border border-emerald-500/30">
            {myFlashId}
          </span>
        </div>
        <button
          onClick={copyMyFlashId}
          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 px-2 py-1 rounded-md border border-emerald-500/30 transition-colors"
        >
          {copied ? "Copied! ✓" : "Copy ID"}
        </button>
      </div>

      {/* Search Input */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-[#222222]">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#555555]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Flash ID (FC-...), phone, or name..."
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
              Search by Flash ID (e.g. {myFlashId}) or mobile number to connect with friends.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-[#FFFFFF]">No Flash user found</p>
            <p className="text-xs text-slate-400 dark:text-[#A0A0A0]">Check the Flash ID or mobile number and try again.</p>
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
                <Avatar src={user.profilePicture || user.avatarUrl} name={user.displayName || user.username} size={11} online={user.isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-[#FFFFFF] truncate">
                      {user.displayName || user.username}
                    </p>
                    {user.flashId && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                        {user.flashId}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] truncate">{user.about || "Hey there! I am using Flash Chat"}</p>
                </div>
                <RelationshipButton
                  user={user}
                  actionState={actionMap[user._id]}
                  onSendRequest={handleSendRequest}
                />
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
      const targetUserId = contactRecord.user?._id || contactRecord._id;
      const conversation = await startDirectConversation(targetUserId);
      const otherUserData = contactRecord.user || contactRecord;
      setSelectedContact({
        _id: conversation._id,
        name: otherUserData.displayName || otherUserData.username || contactRecord.name || "",
        profilePic: otherUserData.profilePicture || contactRecord.profilePic || "",
        isOnline: otherUserData.isOnline || false,
        lastMessage: "",
        unreadCount: 0,
        _conv: conversation,
        otherUser: otherUserData,
      });
      setActiveView("chats");
    } catch {
      toast.error("Failed to open chat");
    }
  }, [startDirectConversation, setSelectedContact, setActiveView]);

  const handleContactAdded = (contactRecord, shouldStartChat = false) => {
    fetchContacts();
    if (shouldStartChat) {
      handleStartChat(contactRecord);
    }
  };

  const requestBadge = pendingRequests.length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans relative">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] px-4 pt-4 pb-0 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-[#FFFFFF]">
            Contacts
          </h1>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#FF6B00]/20 transition-all"
            title="Add New Contact"
          >
            <UserPlus size={13} />
            <span>Add Contact</span>
          </button>
        </div>
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
            {activeTab === "contacts" && (
              <ContactsTab
                onStartChat={handleStartChat}
                onOpenAddModal={() => setIsAddModalOpen(true)}
              />
            )}
            {activeTab === "requests" && <RequestsTab />}
            {activeTab === "people"   && <PeopleTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={handleContactAdded}
      />
    </div>
  );
};

export default ContactsPanel;
