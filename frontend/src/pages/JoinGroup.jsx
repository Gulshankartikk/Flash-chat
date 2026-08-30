import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, CheckCircle, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import axiosInstance from "../services/url.services";
import useChatStore from "../store/chatStore";
import useLayoutStore from "../store/useLayoutStore";
import { toast } from "react-toastify";

const JoinGroup = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groupData, setGroupData] = useState(null);

  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const openConversation = useChatStore((s) => s.openConversation);
  const setSelectedContact = useLayoutStore((s) => s.setSelectedContact);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.post(`/conversations/join/${inviteCode}`);
      if (res?.data?.data) {
        const conv = res.data.data;
        toast.success(`Joined ${conv.groupName}!`);
        await fetchConversations();
        openConversation(conv);
        setSelectedContact({
          _id: conv._id,
          name: conv.groupName,
          profilePic: conv.groupPhoto || "",
          isOnline: false,
          lastSeen: null,
          lastMessage: "",
          unreadCount: 0,
          _conv: conv,
        });
        navigate("/");
      }
    } catch (err) {
      console.error("Join group error:", err);
      const msg = err.response?.data?.message || "Failed to join group with this link";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 text-white font-sans">
      <div className="w-full max-w-sm bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center mx-auto">
          <Users size={32} />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">Group Invitation</h2>
          <p className="text-xs text-slate-400 mt-1">
            You have been invited to join a Flash Chat group.
          </p>
        </div>

        {error ? (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-xs text-red-400 text-left">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="p-4 bg-[#151515] border border-[#222] rounded-2xl text-xs text-slate-300">
            Click below to accept the invitation and start chatting with members.
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 rounded-2xl border border-[#333] hover:bg-[#252525] text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold transition-all shadow-lg shadow-[#FF6B00]/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>Join Group</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinGroup;
