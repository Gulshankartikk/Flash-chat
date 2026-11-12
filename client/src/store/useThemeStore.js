import { create } from 'zustand';

const applyThemeToDOM = (theme) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }
};

const getInitialTheme = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('flash_chat_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
    return 'light';
  }
  return 'dark';
};

export const useThemeStore = create((set, get) => {
  const initialTheme = getInitialTheme();
  applyThemeToDOM(initialTheme);

  return {
    theme: initialTheme,

    initTheme: () => {
      const current = get().theme;
      applyThemeToDOM(current);
    },

    setTheme: (newTheme) => {
      if (newTheme !== 'dark' && newTheme !== 'light') return;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flash_chat_theme', newTheme);
      }
      applyThemeToDOM(newTheme);
      set({ theme: newTheme });
    },

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(nextTheme);
    }
  };
});

export default useThemeStore;
