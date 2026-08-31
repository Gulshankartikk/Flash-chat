import { useEffect, useState, useCallback } from "react";
import useSocket from "./useSocket";
import { toast } from "react-toastify";

let sharedAudioCtx = null;

const playGentleTone = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume();
    }

    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, sharedAudioCtx.currentTime); // D5 tone
    osc.frequency.setValueAtTime(880, sharedAudioCtx.currentTime + 0.1); // A5 tone
    gain.gain.setValueAtTime(0.1, sharedAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, sharedAudioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + 0.35);
  } catch (e) {
    // Non-fatal audio error
  }
};

export const useNotifications = () => {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Request browser notification permissions non-blockingly during idle time
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      const timer = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const addNotification = useCallback((notif) => {
    const id = notif.id || `notif_${Date.now()}`;
    const newNotif = { ...notif, id, timestamp: new Date(), read: false };
    setNotifications((prev) => [newNotif, ...prev]);
    setUnreadCount((c) => c + 1);

    // Show HTML5 native push notification if document is hidden
    if (typeof document !== "undefined" && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(notif.title || "New Notification", {
          body: notif.preview || notif.content,
          icon: notif.avatar || "/logo.png",
        });
      } catch (e) {
        // ignore
      }
    }

    // Play a gentle notification sound
    playGentleTone();
  }, []);

  // Listen to new messages/calls/mentions/reactions via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data) => {
      addNotification(data);

      toast.info(
        <div className="flex items-center gap-3">
          {data.avatar && (
            <img
              src={data.avatar}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <div>
            <p className="font-semibold text-sm">{data.title || "New Alert"}</p>
            <p className="text-xs opacity-80">{data.preview || data.content}</p>
          </div>
        </div>,
        {
          autoClose: 4000,
        }
      );
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [socket, addNotification]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      setUnreadCount(next.filter((n) => !n.read).length);
      return next;
    });
  }, []);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAllAsRead,
    clearNotification,
  };
};

export default useNotifications;
