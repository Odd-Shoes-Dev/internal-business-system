/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // BlueOx Business Platform brand colors - Professional Royal Blue Theme
        blueox: {
          // Professional Royal Blue Palette
          50: '#f0f4ff',
          100: '#e0e7ff', 
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4f46e5', // Professional royal blue
          600: '#2C4BA0', // Main royal blue (darker)
          700: '#1E40AF', // Royal blue dark
          800: '#1e3a8a', // Royal blue darker
          900: '#1e293b', // Royal blue darkest
          950: '#0f172a',
        },
        // BlueOx colors that match browser defaults for undefined classes
         // Black text (browser default)
        // BlueOx specific brand colors
        brand: {
          primary: '#2C4BA0',     // Professional royal blue
          secondary: '#64748b',   // Slate gray
          accent: '#4f46e5',      // Lighter royal blue
          success: '#059669',     // Emerald
          warning: '#d97706',     // Amber
          error: '#dc2626',       // Red
          info: '#1E40AF',        // Royal blue dark
        },
        // Semantic colors for business contexts
        business: {
          revenue: '#059669',     // Green for positive
          expense: '#dc2626',     // Red for negative
          neutral: '#64748b',     // Gray for neutral
          highlight: '#3b82f6',   // Blue for highlights
          muted: '#94a3b8',       // Light gray for muted
        },
        // Legacy breco colors (for backward compatibility) - Professional Royal Blue
        breco: {
          navy: '#2C4BA0',
          'navy-light': '#4f46e5',
          'navy-dark': '#1E40AF',
          'navy-darker': '#1e3a8a',
          gold: '#d97706',
          'gold-light': '#f59e0b',
          'gold-dark': '#b45309',
          teal: '#0891b2',
          'teal-light': '#06b6d4',
          'teal-dark': '#0e7490',
          safari: '#64748b',
          'safari-light': '#94a3b8',
          'safari-dark': '#475569',
        },
      },
      fontFamily: {
        // Professional font stack for business software
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        display: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont', 
          'Segoe UI',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'monospace'
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px 0 rgba(0, 0, 0, 0.1)',
        'medium': '0 4px 25px 0 rgba(0, 0, 0, 0.1)',
        'hard': '0 10px 40px 0 rgba(0, 0, 0, 0.1)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #4f46e5 0%, #2C4BA0 50%, #1E40AF 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)',
        'gradient-accent': 'linear-gradient(135deg, #4f46e5 0%, #2C4BA0 50%, #1E40AF 100%)',
        'gradient-mesh': 'radial-gradient(at 40% 20%, #4f46e5 0px, transparent 50%), radial-gradient(at 80% 0%, #2C4BA0 0px, transparent 50%), radial-gradient(at 0% 50%, #1E40AF 0px, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
