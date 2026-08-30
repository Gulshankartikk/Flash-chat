import React, { useState } from "react";
import { Forward, X, Check, Search, Users, User } from "lucide-react";
import useChatStore from "../../store/chatStore";
import { toast } from "react-toastify";

const ForwardModal = ({ isOpen, onClose, messageToForward }) => {
  const conversations = useChatStore((s) => s.conversations);
  const contactsList = useChatStore((s) => s.contactsList);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !messageToForward) return null;

  const filteredConversations = conversations.filter((c) => {
    const title = c.groupName || c.participants?.find((p) => p._id !== useChatStore.getState().currentUser?._id)?.username || "";
    return title.toLowerCase().includes(query.toLowerCase());
  });

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;

    setIsSending(true);
    try {
      const content = messageToForward.content || messageToForward.message || "";
      const contentType = messageToForward.contentType || "text";

      for (const convId of selectedIds) {
        const conv = conversations.find((c) => c._id === convId);
        if (conv) {
          const receiverId = conv.conversationType === "private"
            ? conv.participants?.find((p) => p._id !== useChatStore.getState().currentUser?._id)?._id
            : undefined;

          await sendMessage({
            conversationId: conv._id,
            receiverId,
            message: content,
            messageType: contentType,
          });
        }
      }

      toast.success(`Message forwarded to ${selectedIds.length} chat(s)`);
      onClose();
      setSelectedIds([]);
    } catch (err) {
      console.error("Forward error:", err);
      toast.error("Failed to forward message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-2">
            <Forward size={18} className="text-[#FF6B00]" />
            <h2 className="text-base font-bold text-slate-800 dark:text-[#FFFFFF]">Forward Message</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-[#222222]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chat or contact..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#FF6B00]"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.map((conv) => {
            const isGroup = conv.conversationType === "group";
            const peer = conv.participants?.find((p) => p._id !== useChatStore.getState().currentUser?._id);
            const title = isGroup ? conv.groupName : (peer?.username || "Chat");
            const isSelected = selectedIds.includes(conv._id);

            return (
              <div
                key={conv._id}
                onClick={() => toggleSelect(conv._id)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#FF6B00]/10 border border-[#FF6B00]/30"
                    : "hover:bg-slate-50 dark:hover:bg-[#151515]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center flex-shrink-0">
                    {isGroup ? <Users size={14} /> : <User size={14} />}
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                    {title}
                  </p>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                      : "border-slate-300 dark:border-[#444]"
                  }`}
                >
                  {isSelected && <Check size={12} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-[#222222] bg-slate-50 dark:bg-[#151515] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#2a2a2a] text-xs font-bold text-slate-700 dark:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={selectedIds.length === 0 || isSending}
            className="flex-1 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6B00]/20"
          >
            {isSending ? "Sending..." : `Forward (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
