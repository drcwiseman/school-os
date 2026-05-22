/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        marketing: {
          navy: "#0f1c2e",
          "navy-deep": "#0a1220",
          sage: "#5c7a62",
          burgundy: "#6b2d3e",
          accent: "#2563eb",
          primary: "#4361ee",
          "primary-light": "#6b84ff",
          soft: "#eef2ff",
          "soft-warm": "#f8f6ff",
          orange: "#f97316",
          cream: "#faf9f7",
          "cream-dark": "#f0eeea",
        },
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8f",
          950: "#172554",
        },
        surface: {
          DEFAULT: "#0f172a",
          raised: "#1e293b",
          overlay: "#334155",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        marketing: "0 8px 32px -8px rgba(15, 28, 46, 0.12)",
        "marketing-lg": "0 24px 64px -16px rgba(15, 28, 46, 0.18)",
        glass: "0 4px 24px -1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
