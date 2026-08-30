import React, { useState, useEffect } from "react";
import useSocket from "../../hooks/useSocket";
import useUserStore from "../../store/useUserStore";
import axiosInstance from "../../services/url.services";
import { toast } from "react-toastify";

const StatusSelector = () => {
  const { socket } = useSocket();
  const user = useUserStore((state) => state.user);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState(user?.about || "");

  useEffect(() => {
    setCustomText(user?.about || "");
  }, [user?.about]);

  const handleStatusChange = async (status) => {
    if (socket && user?._id) {
      socket.emit("set_status", { userId: user._id, status });
    }

    try {
      await axiosInstance.patch(`/users/${user._id}/status`, { status });
      updateProfile({ status });
      toast.success(`Status set to ${status}`);
    } catch (e) {
      console.error("Failed to update status in DB:", e);
      toast.error("Couldn't update your status. Try again.");
    }
    setIsOpen(false);
  };

  const handleCustomTextSubmit = async (e) => {
    e.preventDefault();
    if (!customText.trim()) return;

    try {
      await axiosInstance.patch(`/users/${user._id}/status`, {
        customStatusText: customText.trim(),
      });
      updateProfile({ about: customText.trim() });
      toast.success("Status message updated");
    } catch (e) {
      console.error("Failed to update custom status text:", e);
      toast.error("Couldn't save your status message. Try again.");
    }
  };

  return (
    <div className="relative text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#1c1c1c] border border-[#222222] hover:border-[#FF6B00] rounded-lg text-xs font-semibold text-[#FFFFFF] transition-all"
      >
        Set Status 🟢
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#1c1c1c] border border-[#222222] rounded-xl shadow-2xl p-3 z-30 space-y-3">
          <p className="text-[10px] uppercase font-bold text-[#A0A0A0] tracking-wider">
            Presence
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleStatusChange("online")}
              className="flex items-center gap-2 px-2 py-1 hover:bg-[#222222] rounded text-xs text-[#FFFFFF] text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD166]" /> Online
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("away")}
              className="flex items-center gap-2 px-2 py-1 hover:bg-[#222222] rounded text-xs text-[#FFFFFF] text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFB300]" /> Away
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("busy")}
              className="flex items-center gap-2 px-2 py-1 hover:bg-[#222222] rounded text-xs text-[#FFFFFF] text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF3D71]" /> Busy (DND)
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("offline")}
              className="flex items-center gap-2 px-2 py-1 hover:bg-[#222222] rounded text-xs text-[#FFFFFF] text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#555555]" /> Invisible
            </button>
          </div>

          <div className="border-t border-[#222222] pt-2">
            <p className="text-[10px] uppercase font-bold text-[#A0A0A0] tracking-wider mb-2">
              Status Message
            </p>
            <form onSubmit={handleCustomTextSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="What's happening?"
                className="flex-1 bg-black text-[#FFFFFF] px-2 py-1 text-xs rounded border border-[#222222] focus:outline-none focus:border-[#FF6B00]"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-[#FF6B00] text-white rounded text-[10px] font-bold"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusSelector;