import React from 'react';
import { Search, Bell, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from './Avatar';

export const PageHeader = ({ title, subtitle, onOpenSearch, rightAction }) => {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white/95 backdrop-blur-md border-b border-[#FED7AA] flex-shrink-0">
      {/* Title & mobile logo */}
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white flex items-center justify-center font-black text-sm shadow-md shadow-orange-500/25">
          ⚡
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#1F2937]">
            {title || 'Flash Chat'}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-[#6B7280] hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-[#FED7AA] hover:bg-[#FFF7ED] text-[#6B7280] hover:text-[#1F2937] transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Search Users"
          >
            <Search className="w-4 h-4 text-[#F97316]" />
            <span className="hidden sm:inline">Search</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-[#FED7AA] hover:bg-[#FFF7ED] text-[#6B7280] hover:text-[#1F2937] transition cursor-pointer"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {rightAction}

        <div className="md:hidden">
          <Avatar src={user?.avatar} alt={user?.name} size="xs" />
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
