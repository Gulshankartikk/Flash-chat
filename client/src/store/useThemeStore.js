import { create } from 'zustand';

const applyThemeToDOM = (theme) => {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

export const useThemeStore = create((set, get) => {
  const initialTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('flash_chat_theme')) || 'dark';
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
