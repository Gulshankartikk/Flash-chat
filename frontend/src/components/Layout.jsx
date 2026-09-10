import React, { useEffect, useState, lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import useLayoutStore from "../store/useLayoutStore";
import useThemeStore from "../store/useThemeStore";

// Lazy load ChatWindow so initial startup load is smaller and faster
const ChatWindow = lazy(() => import("../pages/chatSection/ChatWindow"));

const ChatWindowFallback = () => (
  <div className="flex-1 h-full w-full flex items-center justify-center bg-slate-50 dark:bg-[#000000]">
    <div className="w-6 h-6 border-2 border-slate-300 dark:border-[#222222] border-t-[#FF6B00] rounded-full animate-spin" />
  </div>
);

/*
 * LAYOUT & SCROLL ARCHITECTURE
 *
 * Layout (h-screen max-h-screen overflow-hidden)
 *   ├── Sidebar (Fixed icon navigation rail, desktop only)
 *   └── Main Container (flex-1 flex overflow-hidden min-h-0)
 *         ├── Contacts / Chats Panel (w-full md:w-[400px] h-full flex flex-col min-h-0 overflow-hidden)
 *         │     └── HomePage / ContactsPanel (flex-1 min-h-0 overflow-y-auto)
 *         └── Chat Area (flex-1 h-full min-h-0 flex flex-col overflow-hidden)
 *               ├── ChatHeader (flex-shrink-0 sticky top-0)
 *               ├── MessageList (flex-1 min-h-0 overflow-y-auto)
 *               └── ChatInput (flex-shrink-0 sticky bottom-0)
 *
 * Independent Scrolling Guarantee:
 * Contact list scroll and chat message scroll containers are completely decoupled.
 * Neither pane triggers window or document-level scrolling.
 */

const DesktopEmptyChat = () => (
  <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#000000] text-slate-400 dark:text-[#A0A0A0] p-8 select-none">
    <div className="w-20 h-20 rounded-3xl bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] mb-5 shadow-inner">
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 tracking-tight">Flash Chat Web</h2>
    <p className="text-xs text-slate-500 dark:text-[#A0A0A0] max-w-sm text-center leading-relaxed mb-6">
      Send and receive real-time messages, make encrypted HD voice and video calls, and use AI-powered smart writing assistance.
    </p>
    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-[#555555] bg-slate-100 dark:bg-[#111111] px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-[#222222]">
      <svg className="w-3.5 h-3.5 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>End-to-end encrypted messaging</span>
    </div>
  </div>
);

const Layout = ({
  children,
  isThemeDialogOpen,
  toggleDialog,
  isStatusPreviewOpen,
  statusPreviewContent,
}) => {
  const selectedContact = useLayoutStore((state) => state.selectedContact);
  const setSelectedContact = useLayoutStore((state) => state.setSelectedContact);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    let ticking = false;
    const handleResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsMobile(window.innerWidth < 768);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="h-screen max-h-screen overflow-hidden flex relative bg-slate-50 dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans">
      <style>{`
        .lo-theme-option { transition: background 0.12s ease, border-color 0.12s ease; }
        .lo-theme-option:hover { filter: brightness(1.15); }
      `}</style>

      {!isMobile && <Sidebar />}

      <div className="flex-1 flex overflow-hidden flex-col md:flex-row min-h-0">
        <AnimatePresence initial={false}>
          {(!selectedContact || !isMobile) && (
            <motion.div
              key="chatlist"
              initial={{ x: isMobile ? "-100%" : 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween" }}
              className="w-full md:w-[400px] h-full flex flex-col flex-shrink-0 border-r border-slate-200 dark:border-[#222222] bg-white dark:bg-[#000000] min-h-0 overflow-hidden"
              style={{
                paddingBottom: isMobile ? "64px" : "0px",
              }}
            >
              {children || <Outlet />}
            </motion.div>
          )}

          {selectedContact ? (
            <motion.div
              key="chatwindow"
              initial={{ x: isMobile ? "100%" : 0 }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween" }}
              className="flex-1 h-full w-full min-h-0 flex flex-col overflow-hidden"
            >
              <Suspense fallback={<ChatWindowFallback />}>
                <ChatWindow
                  selectedContact={selectedContact}
                  setSelectedContact={setSelectedContact}
                  isMobile={isMobile}
                />
              </Suspense>
            </motion.div>
          ) : (
            !isMobile && <DesktopEmptyChat key="desktop-empty" />
          )}
        </AnimatePresence>

        {isMobile && <Sidebar />}
      </div>

      {/* Theme Dialog */}
      {isThemeDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] text-slate-800 dark:text-[#FFFFFF] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold mb-1">Appearance</h2>
            <p className="text-xs text-slate-400 dark:text-[#A0A0A0] mb-4">Choose how Flash Chat looks on this device.</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold cursor-pointer lo-theme-option ${
                  theme === "light"
                    ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                    : "border-slate-200 dark:border-[#222222] bg-transparent text-slate-400 dark:text-[#A0A0A0]"
                }`}
              >
                Light
                {theme === "light" && <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />}
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold cursor-pointer lo-theme-option ${
                  theme === "dark"
                    ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                    : "border-slate-200 dark:border-[#222222] bg-transparent text-slate-400 dark:text-[#A0A0A0]"
                }`}
              >
                Dark
                {theme === "dark" && <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />}
              </button>
            </div>

            <button
              onClick={toggleDialog}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-sm font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;