import React, { useEffect, useState, lazy, Suspense } from "react";
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
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen flex relative bg-slate-50 dark:bg-[#000000] text-slate-800 dark:text-[#FFFFFF] font-sans">
      <style>{`
        .lo-theme-option { transition: background 0.12s ease, border-color 0.12s ease; }
        .lo-theme-option:hover { filter: brightness(1.15); }
      `}</style>

      {!isMobile && <Sidebar />}

      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
        <AnimatePresence initial={false}>
          {(!selectedContact || !isMobile) && (
            <motion.div
              key="chatlist"
              initial={{ x: isMobile ? "-100%" : 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween" }}
              className="w-full md:w-[400px] h-full flex flex-col flex-shrink-0 border-r border-slate-200 dark:border-[#222222] bg-white dark:bg-[#000000]"
              style={{
                paddingBottom: isMobile ? "64px" : "0px",
              }}
            >
              {children}
            </motion.div>
          )}

          {selectedContact && (
            <motion.div
              key="chatwindow"
              initial={{ x: isMobile ? "100%" : 0 }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween" }}
              className="flex-1 h-full w-full"
            >
              <Suspense fallback={<ChatWindowFallback />}>
                <ChatWindow
                  selectedContact={selectedContact}
                  setSelectedContact={setSelectedContact}
                  isMobile={isMobile}
                />
              </Suspense>
            </motion.div>
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