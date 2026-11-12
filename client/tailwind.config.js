/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        card: 'var(--card)',
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        'bg-a': 'var(--bg-a)',
        'bg-b': 'var(--bg-b)',
        'bg-c': 'var(--bg-c)',
        glass: 'var(--glass)',
        'glass-2': 'var(--glass-2)',
        side: 'var(--side)',
        edge: 'var(--edge)',
        'coral-a': 'var(--coral-a)',
        'coral-b': 'var(--coral-b)',
        good: 'var(--good)',
        bad: 'var(--bad)',
        brand: {
          DEFAULT: 'var(--primary)',
          coral: '#f0735f',
          amber: '#FFB36B',
          gold: '#FFD166',
          charcoal: '#14110F',
          espresso: '#211A17',
          ivory: '#FFF7ED',
          magenta: '#FF7849',
          purple: '#FFB36B',
          pink: '#FF7849',
          rose: '#FFD166',
        }
      },
      borderRadius: {
        'xl': '1rem',      // 16px cards
        '2xl': '1.5rem',   // 24px sheets
        '3xl': '2rem',
        'glass': '26px',   // 24-28px glassy cards
        'full': '9999px',  // avatars/chips
      },
      boxShadow: {
        'soft': 'var(--soft-shadow)',
        'soft-dark': '0 8px 30px rgba(0, 0, 0, 0.7)',
        'glass': 'inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 12px 32px -4px rgba(42, 23, 18, 0.22)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'brand-gradient': 'var(--brand-gradient)',
        'brand-gradient-hover': 'var(--brand-gradient-hover)',
      }
    },
  },
  plugins: [],
}
