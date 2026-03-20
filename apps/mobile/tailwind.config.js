/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand — Teal (primary SafeDose brand color)
        brand: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },

        // Neutral — Slate
        neutral: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },

        // Severity — Drug Interaction
        severity: {
          contraindicated: '#DC2626',
          major:           '#EA580C',
          moderate:        '#D97706',
          minor:           '#2563EB',
          safe:            '#16A34A',
        },

        // Dose Status
        dose: {
          taken:    '#16A34A',
          late:     '#D97706',
          missed:   '#DC2626',
          due:      '#2563EB',
          upcoming: '#94A3B8',
          paused:   '#94A3B8',
        },

        // Semantic App States
        state: {
          success: '#16A34A',
          warning: '#D97706',
          error:   '#DC2626',
          info:    '#2563EB',
          neutral: '#64748B',
        },

        // Surface
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#F8FAFC',
          dark:    '#0f172a',
        },

        // Module tint backgrounds — ultra-low opacity washes per feature zone
        moduleTint: {
          medications: 'rgba(13, 148, 136, 0.06)',   // teal  6%
          schedule:    'rgba(59, 130, 246, 0.06)',    // blue  6%
          caregiving:  'rgba(139, 92, 246, 0.06)',    // violet 6%
          emergency:   'rgba(239, 68, 68, 0.06)',     // red   6%
          settings:    'rgba(100, 116, 139, 0.04)',   // slate 4%
        },
      },
    },
  },
  plugins: [],
};
