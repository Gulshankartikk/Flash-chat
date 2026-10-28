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
        muted: 'var(--muted)',
        line: 'var(--line)',
        brand: {
          DEFAULT: 'var(--primary)',
          magenta: '#D946EF',
          purple: '#A855F7',
          pink: '#EC4899',
          rose: '#F43F5E',
        }
      },
      borderRadius: {
        'xl': '1rem',      // 16px cards
        '2xl': '1.5rem',   // 24px sheets
        '3xl': '2rem',
        'full': '9999px',  // avatars/chips
      },
      boxShadow: {
        'soft': 'var(--soft-shadow)',
        'soft-dark': '0 8px 30px rgba(0, 0, 0, 0.6)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'var(--brand-gradient)',
        'brand-gradient-hover': 'var(--brand-gradient-hover)',
      }
    },
  },
  plugins: [],
}
