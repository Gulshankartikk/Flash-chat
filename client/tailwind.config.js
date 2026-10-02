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
        warmCream: '#FFF7ED',
        cardWhite: '#FFFFFF',
        brandOrange: '#F97316',
        brandPink: '#EC4899',
        brandRose: '#F43F5E',
        textNavy: '#1F2937',
        mutedGray: '#6B7280',
        borderOrange: '#FED7AA',
        primary: {
          DEFAULT: '#F97316',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        secondary: {
          DEFAULT: '#EC4899',
          500: '#EC4899',
          600: '#DB2777',
        },
        accent: {
          DEFAULT: '#F43F5E',
          500: '#F43F5E',
          600: '#E11D48',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
        'brand-gradient-hover': 'linear-gradient(135deg, #EA580C 0%, #DB2777 100%)',
      }
    },
  },
  plugins: [],
}
