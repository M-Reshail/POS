/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Indigo-blue brand scale — used for headers, sidebar, hero sections, primary UI chrome
        brand: {
          900: "#383794",
          800: "#4342B1",
          700: "#4D4CCC",
          600: "#5654E3",
        },
        // Warm gold accent — bright/shiny, matches warehouse/headlight lighting from the login background
        accent: {
          400: "#FFD666",
          500: "#F5B93C",
          600: "#D69A1E",
        },
        // Neutral surfaces
        surface: {
          DEFAULT: "#F7F8FA",
          card: "#FFFFFF",
          muted: "#EEF1F5",
        },
        border: {
          DEFAULT: "#E2E6EC",
          strong: "#CBD3DE",
        },
        ink: {
          DEFAULT: "#101828",
          muted: "#5B6472",
          subtle: "#8A93A3",
        },
        // Semantic status colors — use ONLY for actual status meaning, never decoratively
        success: {
          50: "#EAF7F0",
          500: "#1F9D66",
          600: "#178253",
        },
        danger: {
          50: "#FDEEEE",
          500: "#DC3545",
          600: "#B42A38",
        },
        warning: {
          50: "#FBF3E4",
          500: "#D9A63E",
          600: "#B8842A",
        },
        info: {
          50: "#EAF1FA",
          500: "#2563A8",
          600: "#1B4C7E",
        },
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        control: "10px",
        card: "16px",
        hero: "22px",
      },
    },
  },
  plugins: [],
}
