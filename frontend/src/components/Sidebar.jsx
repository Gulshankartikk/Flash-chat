import React, { useEffect } from "react";
import { MessageCircle, Users, Settings, Moon, Sun, ArrowLeft, LogOut, CircleDot } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import useThemeStore from "../store/useThemeStore";
import useLayoutStore from "../store/useLayoutStore";
import useUserStore from "../store/useUserStore";
import useChatStore from "../store/chatStore";

const NAV_ITEMS = [
  { id: "chats", label: "Chats", icon: MessageCircle, path: "/" },
  { id: "contacts", label: "Contacts", icon: Users, path: "/" },
  { id: "status", label: "Status", icon: CircleDot, path: "/status" },
  { id: "settings", label: "Settings", icon: Settings, path: "/setting" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { theme, setTheme } = useThemeStore();
  const dark = theme === "dark";

  const selectedContact = useLayoutStore((state) => state.selectedContact);
  const setSelectedContact = useLayoutStore((state) => state.setSelectedContact);

  const activeView = useLayoutStore((state) => state.activeView);
  const setActiveView = useLayoutStore((state) => state.setActiveView);

  const currentUser = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const pendingRequests = useChatStore((s) => s.pendingRequests);

  const isMobileWidth = window.innerWidth < 768;

  const initials = (currentUser?.username || currentUser?.name || "?")
    .charAt(0)
    .toUpperCase();

  // Sync activeView with URL path
  useEffect(() => {
    const path = location.pathname;
    if (path === "/status") {
      setActiveView("status");
    } else if (path === "/setting") {
      setActiveView("settings");
    } else if (path === "/") {
      if (activeView !== "chats" && activeView !== "contacts") {
        setActiveView("chats");
      }
    }
  }, [location.pathname, setActiveView, activeView]);

  const handleNavClick = (item) => {
    setActiveView(item.id);
    navigate(item.path);
  };

  return (
    <div
      className={`flex z-40 flex-shrink-0 font-sans ${
        isMobileWidth
          ? "flex-row w-full justify-between items-center px-6 py-2.5 fixed bottom-0 left-0 border-t border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111]"
          : "flex-col w-20 h-full items-center py-6 border-r border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] gap-6"
      }`}
    >
      {/* Profile avatar (desktop only) — tap to open Settings */}
      {!isMobileWidth && (
        <button
          onClick={() => { navigate("/setting"); setActiveView("settings"); }}
          className="relative group transition-transform duration-150 hover:scale-105"
          title={currentUser?.username || currentUser?.name || "Your profile"}
        >
          {currentUser?.profilePicture ? (
            <img
              src={currentUser.profilePicture}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#222222]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-base border border-slate-200 dark:border-[#222222]">
              {initials}
            </div>
          )}
          {/* Pulsing cyan dot for online users */}
          {currentUser?.isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#FFD166] border-2 border-white dark:border-[#111111] animate-pulse" />
          )}
        </button>
      )}

      {/* Navigation Icons */}
      <div
        className={`flex items-center gap-1 ${
          isMobileWidth ? "flex-row w-full justify-around" : "flex-col w-full flex-1 gap-3"
        }`}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          const badge = item.id === "contacts" ? pendingRequests.length : 0;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`relative p-3 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 ${
                isActive
                  ? "text-[#FF6B00] bg-[#FF6B00]/10 scale-105"
                  : "text-slate-400 dark:text-[#A0A0A0] hover:text-slate-700 dark:hover:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#1c1c1c]"
              }`}
              title={item.label}
            >
              <Icon size={20} />
              {/* Pending requests badge on Contacts icon */}
              {badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 rounded-full bg-[#FF6B00] text-white text-[8px] font-black flex items-center justify-center px-0.5 shadow-md shadow-[#FF6B00]/40 animate-pulse">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {/* Active bar (desktop: left edge indicator, mobile: small bottom dot) */}
              {isActive && !isMobileWidth && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#FF6B00] rounded-r-full shadow-[0_0_8px_#FF6B00]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div
        className={`flex items-center gap-2 ${
          isMobileWidth ? "flex-row" : "flex-col"
        }`}
      >
        {selectedContact && !isMobileWidth && (
          <button
            onClick={() => { setSelectedContact(null); navigate("/"); }}
            className="p-2.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl shadow-lg transition-transform duration-150 active:scale-95"
            title="Back to list"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        <button
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="p-2.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-xl text-slate-400 dark:text-[#A0A0A0] hover:text-slate-700 dark:hover:text-[#FFFFFF] transition-colors"
          title={dark ? "Switch to light" : "Switch to dark"}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {!isMobileWidth && (
          <button
            onClick={() => logout && logout()}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-xl text-[#FF9E00] hover:text-[#E08B00] transition-colors mt-2"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;