import React, { useState, useContext, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Pin, X } from "lucide-react";
import { toast } from "react-toastify";
import useChatStore from "../../store/chatStore";
import useUserStore from "../../store/useUserStore";
import useLayoutStore from "../../store/useLayoutStore";
import { CallContext } from "../../context/CallContext";
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import ChatInput from "../../components/chat/ChatInput";
import TypingIndicator from "../../components/chat/TypingIndicator";

const ChatWindow = ({ selectedContact, setSelectedContact, isMobile }) => {
  const currentUser = useUserStore((s) => s.user);

  const activeConversation = useChatStore((s) => s.activeConversation);
  const messages            = useChatStore((s) => s.messages);
  const isLoadingMessages   = useChatStore((s) => s.isLoadingMessages);
  const sendMessage         = useChatStore((s) => s.sendMessage);
  const deleteMessage       = useChatStore((s) => s.deleteMessage);
  const reactToMessage       = useChatStore((s) => s.reactToMessage);
  const startTyping         = useChatStore((s) => s.startTyping);
  const stopTyping          = useChatStore((s) => s.stopTyping);
  const getTypingUsers      = useChatStore((s) => s.getTypingUsers);
  const replyTo             = useChatStore((s) => s.replyTo);
  const setReplyTo          = useChatStore((s) => s.setReplyTo);
  const clearReplyTo        = useChatStore((s) => s.clearReplyTo);

  const editMessage         = useChatStore((s) => s.editMessage);
  const pinMessage          = useChatStore((s) => s.pinMessage);
  const forwardMessage      = useChatStore((s) => s.forwardMessage);

  const contacts            = useLayoutStore((s) => s.contacts);

  const { startCall } = useContext(CallContext);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // debounced value actually used to filter

  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [forwardTargets, setForwardTargets] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);

  const forwardModalRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const otherUser =
    activeConversation?.participants?.find((p) => {
      const pId = typeof p === "object" ? p?._id : p;
      return String(pId) !== String(currentUser?._id);
    }) ||
    selectedContact?.otherUser ||
    selectedContact;

  const otherUserId = typeof otherUser === "object" ? otherUser?._id : otherUser;

  const typingUserIds = activeConversation
    ? getTypingUsers(activeConversation._id)
    : [];
  const isOtherTyping = otherUserId ? typingUserIds.includes(otherUserId) : false;

  // Stable identities so effects below can safely list these in deps
  const closeSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setSearchOpen(false);
  }, []);

  const closeForwardModal = useCallback(() => {
    if (isForwarding) return; // don't let Escape/outside-click cancel mid-request
    setForwardingMsg(null);
    setForwardTargets([]);
  }, [isForwarding]);

  // Debounce search input -> searchQuery so large message lists aren't
  // re-filtered on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput), 200);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Autofocus the search field when it opens
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Remember what had focus before opening the forward modal, and restore it on close
  useEffect(() => {
    if (forwardingMsg) {
      lastFocusedRef.current = document.activeElement;
      forwardModalRef.current?.focus();
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus?.();
      lastFocusedRef.current = null;
    }
  }, [forwardingMsg]);

  // Escape closes whichever overlay is open (modal takes priority over search)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      if (forwardingMsg) {
        closeForwardModal();
      } else if (searchOpen) {
        closeSearch();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [forwardingMsg, searchOpen, closeForwardModal, closeSearch]);

  // Click-outside closes the forward modal
  useEffect(() => {
    if (!forwardingMsg) return;
    const handleClickOutside = (e) => {
      if (forwardModalRef.current && !forwardModalRef.current.contains(e.target)) {
        closeForwardModal();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [forwardingMsg, closeForwardModal]);

  // Basic focus trap inside the forward modal
  useEffect(() => {
    if (!forwardingMsg) return;
    const handleTab = (e) => {
      if (e.key !== "Tab" || !forwardModalRef.current) return;
      const focusable = forwardModalRef.current.querySelectorAll(
        'button, [tabindex]:not([tabindex="-1"]), input'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [forwardingMsg]);

  const handleSend = ({ message, messageType, mediaFile }) => {
    if (!otherUserId) return;
    sendMessage({ receiverId: otherUserId, message, messageType, mediaFile });
  };

  const handleDelete = (msg, deleteFor) => deleteMessage(msg._id, deleteFor);
  const handleReact = (msg, emoji) => reactToMessage(msg._id, emoji);
  const handleVoiceCall = () => { if (otherUser) startCall(otherUser, "voice"); };
  const handleVideoCall = () => { if (otherUser) startCall(otherUser, "video"); };

  const handleEdit = async (msg, newText) => {
    try {
      await editMessage(msg._id, newText);
      toast.success("Message edited successfully");
    } catch (err) {
      toast.error("Failed to edit message");
    }
  };

  const handlePin = async (msg) => {
    try {
      await pinMessage(msg._id);
      toast.success(msg.isPinned ? "Message unpinned" : "Message pinned");
    } catch (err) {
      toast.error("Failed to pin message");
    }
  };

  const toggleForwardTarget = (contactId) => {
    setForwardTargets((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const allSelected = contacts.length > 0 && forwardTargets.length === contacts.length;
  const toggleSelectAll = () => {
    setForwardTargets(allSelected ? [] : contacts.map((c) => c._id));
  };

  const handleForwardSend = async () => {
    if (forwardTargets.length === 0 || isForwarding) return;
    setIsForwarding(true);
    try {
      await forwardMessage(forwardingMsg, forwardTargets);
      toast.success("Message forwarded!");
      setForwardingMsg(null);
      setForwardTargets([]);
    } catch (e) {
      toast.error("Failed to forward message");
    } finally {
      setIsForwarding(false);
    }
  };

  const pinnedMessage = messages.find((m) => m.isPinned && !m.isDeletedForEveryone && !m.isDeleted);

  const displayedMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.content || m.message || "").toLowerCase().includes(q));
  }, [searchQuery, messages]);

  const isSearchActive = searchOpen && searchQuery.trim().length > 0;

  if (!selectedContact) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-[#000000] text-slate-400 dark:text-[#A0A0A0] font-sans">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5h16v10H9l-4 4v-4H4V5Z"
            stroke="#FF6B00"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_#FF6B00]"
          />
        </svg>
        <p className="text-base font-semibold text-slate-800 dark:text-[#FFFFFF]">No conversation open</p>
        <p className="text-xs max-w-xs text-center opacity-70">
          Select a user from the sidebar to begin messaging.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans relative">
      <ChatHeader
        otherUser={otherUser}
        conversation={activeConversation}
        isMobile={isMobile}
        onBack={() => setSelectedContact(null)}
        isTyping={isOtherTyping}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
        onSearchToggle={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
      />

      {searchOpen && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] flex items-center gap-2 animate-fade-in">
          <Search size={14} className="text-slate-400 dark:text-[#555555] flex-shrink-0" aria-hidden="true" />
          <label htmlFor="message-search" className="sr-only">
            Search messages in this conversation
          </label>
          <input
            id="message-search"
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-white dark:bg-black text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-[#222222] focus:outline-none focus:border-[#FF6B00]"
          />
          <button type="button" onClick={closeSearch} className="text-xs text-[#A0A0A0] hover:text-[#FF9E00] flex-shrink-0">
            Cancel
          </button>
        </div>
      )}
      {isSearchActive && (
        <p className="sr-only" role="status" aria-live="polite">
          {displayedMessages.length} message{displayedMessages.length !== 1 ? "s" : ""} found
        </p>
      )}

      {pinnedMessage && (
        <div className="bg-slate-50 dark:bg-[#1c1c1c] border-b border-slate-200 dark:border-[#222222] px-4 py-2 flex items-center justify-between text-xs text-slate-400 dark:text-[#A0A0A0] gap-3">
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 text-left"
            onClick={() => {
              const element = document.getElementById(`msg-${pinnedMessage._id}`);
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
                element.classList.add("bg-[#FF6B00]/25");
                setTimeout(() => element.classList.remove("bg-[#FF6B00]/25"), 2000);
              }
            }}
          >
            <Pin size={12} className="text-[#FFD166] rotate-45 flex-shrink-0" aria-hidden="true" />
            <span className="font-semibold text-slate-800 dark:text-white flex-shrink-0">Pinned Message:</span>
            <span className="truncate flex-1">{pinnedMessage.content || "Media"}</span>
          </button>
          <button type="button" onClick={() => handlePin(pinnedMessage)} className="text-[#FF3D71] hover:underline flex-shrink-0 text-[10px]">
            Unpin
          </button>
        </div>
      )}

      {isSearchActive && displayedMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <p className="text-sm text-slate-400 dark:text-[#A0A0A0]">
            No messages match "{searchQuery.trim()}"
          </p>
        </div>
      ) : (
        <MessageList
          messages={displayedMessages}
          currentUserId={currentUser?._id}
          isLoadingMore={isLoadingMessages}
          hasMore={false}
          onReply={(msg) => setReplyTo(msg)}
          onReact={handleReact}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onPin={handlePin}
          onForward={(msg) => setForwardingMsg(msg)}
          onReplyPreviewClick={(reply) => {
            const element = document.getElementById(`msg-${reply._id}`);
            if (element) element.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {isOtherTyping && <TypingIndicator name={otherUser?.username || otherUser?.name} />}

      <ChatInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={clearReplyTo}
        otherUserId={otherUserId}
        otherUserName={otherUser?.username || otherUser?.name || "Contact"}
        onTypingStart={() => startTyping(otherUserId)}
        onTypingStop={() => stopTyping(otherUserId)}
      />

      {forwardingMsg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forward-modal-title"
        >
          <div
            ref={forwardModalRef}
            tabIndex={-1}
            className="w-full max-w-sm bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl p-6 shadow-2xl flex flex-col max-h-[80vh] focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-3">
              <h3 id="forward-modal-title" className="text-slate-800 dark:text-white font-bold text-base text-left">
                Forward Message
              </h3>
              <button
                type="button"
                onClick={closeForwardModal}
                disabled={isForwarding}
                aria-label="Close"
                className="text-slate-400 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-white disabled:opacity-40 p-1 rounded-full"
              >
                <X size={16} />
              </button>
            </div>

            {contacts.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-[#FF6B00] hover:underline text-left mb-2 self-start"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            )}

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-[#222222] mb-4" role="group" aria-label="Select contacts to forward to">
              {contacts.map((contact) => {
                const isChecked = forwardTargets.includes(contact._id);
                return (
                  <div
                    key={contact._id}
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={contact.name}
                    tabIndex={0}
                    onClick={() => toggleForwardTarget(contact._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleForwardTarget(contact._id);
                      }
                    }}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1c1c1c] px-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleForwardTarget(contact._id)}
                      tabIndex={-1}
                      className="accent-[#FF6B00] rounded pointer-events-none"
                    />
                    <img
                      src={contact.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=25D366&color=fff`}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-[#222222]"
                    />
                    <span className="text-sm font-semibold text-slate-800 dark:text-white text-left truncate flex-1">{contact.name}</span>
                  </div>
                );
              })}
              {contacts.length === 0 && (
                <p className="text-xs text-center text-slate-400 dark:text-[#A0A0A0] py-6">
                  No contacts available to forward to.
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={closeForwardModal}
                disabled={isForwarding}
                className="flex-1 py-2.5 border border-slate-200 dark:border-[#222222] hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-800 dark:text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForwardSend}
                disabled={forwardTargets.length === 0 || isForwarding}
                className="flex-1 py-2.5 bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
              >
                {isForwarding ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;