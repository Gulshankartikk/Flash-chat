import React, { useState, useEffect } from "react";
import { Laptop, Smartphone, Globe, Shield, Trash2, X, RefreshCw, CheckCircle } from "lucide-react";
import axiosInstance from "../../services/url.services";
import { toast } from "react-toastify";

const ActiveSessionsModal = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/users/sessions");
      setSessions(res?.data?.data || []);
    } catch (err) {
      toast.error("Failed to load active sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const handleRevokeSession = async (sessionId) => {
    setRevokingId(sessionId);
    try {
      await axiosInstance.delete(`/users/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      toast.success("Session logged out");
    } catch (err) {
      toast.error("Failed to revoke session");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    try {
      await axiosInstance.delete("/users/sessions/other");
      toast.success("Logged out from all other devices");
      fetchSessions();
    } catch (err) {
      toast.error("Failed to revoke other sessions");
    }
  };

  if (!isOpen) return null;

  const getDeviceIcon = (userAgent = "") => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone size={18} className="text-[#FF6B00]" />;
    }
    if (ua.includes("mac") || ua.includes("windows") || ua.includes("linux")) {
      return <Laptop size={18} className="text-[#FF6B00]" />;
    }
    return <Globe size={18} className="text-[#FF6B00]" />;
  };

  const formatDeviceName = (userAgent = "") => {
    if (!userAgent) return "Web Browser";
    if (userAgent.includes("Windows")) return "Windows PC";
    if (userAgent.includes("Macintosh")) return "MacBook / macOS";
    if (userAgent.includes("Android")) return "Android Phone";
    if (userAgent.includes("iPhone")) return "iPhone";
    if (userAgent.includes("Linux")) return "Linux Device";
    return userAgent.slice(0, 30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#FF6B00]" />
            <h2 className="text-base font-bold text-slate-800 dark:text-[#FFFFFF]">Active Login Sessions</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-[#FF6B00]" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No active sessions recorded.
            </div>
          ) : (
            sessions.map((sess, idx) => (
              <div
                key={sess.sessionId || idx}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#151515] hover:border-slate-200 dark:hover:border-[#333] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FF6B00]/10 flex items-center justify-center">
                    {getDeviceIcon(sess.device)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-[#FFFFFF]">
                        {formatDeviceName(sess.device)}
                      </p>
                      {idx === 0 && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5">
                          <CheckCircle size={9} /> Current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] mt-0.5">
                      IP: {sess.ip || "127.0.0.1"} • {sess.lastActive ? new Date(sess.lastActive).toLocaleDateString() : "Just now"}
                    </p>
                  </div>
                </div>

                {idx !== 0 && (
                  <button
                    onClick={() => handleRevokeSession(sess.sessionId)}
                    disabled={revokingId === sess.sessionId}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Log out device"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#222222] bg-slate-50 dark:bg-[#151515] flex gap-3">
          <button
            onClick={handleRevokeAllOther}
            className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold transition-all text-center"
          >
            Log out from all other devices
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-[#222222] text-slate-700 dark:text-[#FFFFFF] text-xs font-bold hover:bg-slate-300 dark:hover:bg-[#333] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionsModal;
