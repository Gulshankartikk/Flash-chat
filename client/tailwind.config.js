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
          orange: '#F97316',
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
        'soft': '0 8px 30px rgba(249, 115, 22, 0.12)',
        'soft-dark': '0 8px 30px rgba(0, 0, 0, 0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
        'brand-gradient-hover': 'linear-gradient(135deg, #EA580C 0%, #DB2777 100%)',
      }
    },
  },
  plugins: [],
}
