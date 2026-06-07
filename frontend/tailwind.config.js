/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a0c',
          1: '#111114',
          2: '#17171b',
          3: '#1e1e24',
          4: '#26262e',
        },
        accent: '#6ee7b7',
        ink: {
          DEFAULT: '#e7e7ea',
          dim: '#9a9aa3',
          faint: '#5c5c66',
        },
      },
      borderColor: {
        DEFAULT: '#ffffff12',
        subtle: '#ffffff12',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        blink: 'blink 1.1s steps(1) infinite',
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
