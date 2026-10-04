import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from './Avatar';

export const PageHeader = ({ title, subtitle, onOpenSearch, rightAction }) => {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-card/95 backdrop-blur-md border-b border-line flex-shrink-0">
      {/* Title & mobile logo */}
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-black text-sm shadow-soft">
          ⚡
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
            {title || 'Flash Chat'}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-muted hidden sm:block">
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
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-line hover:bg-cream text-muted hover:text-ink transition flex items-center gap-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            title="Search Users (⌘K)"
            aria-label="Search users"
          >
            <Search className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Search</span>
          </button>
        )}

        {/* Contacts Shortcut Button */}
        <button
          type="button"
          onClick={() => navigate('/contacts')}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-line hover:bg-cream text-muted hover:text-ink transition flex items-center gap-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
          title="Manual Contacts"
          aria-label="Contacts"
        >
          <Users className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Contacts</span>
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-line hover:bg-cream text-muted hover:text-ink transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
          title="Toggle Theme"
          aria-label="Toggle light or dark theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {rightAction}

        <div className="md:hidden cursor-pointer" onClick={() => navigate('/profile')}>
          <Avatar src={user?.avatar} alt={user?.name} size="xs" />
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
