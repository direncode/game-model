import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cp: {
          black: "#000000",
          "black-light": "#06060a",
          "black-elevated": "#0c0c12",
          "black-surface": "#111118",
          "gray-900": "#161620",
          "gray-800": "#1e1e2a",
          "gray-700": "#2a2a3a",
          "gray-600": "#6b6b80",
          "gray-500": "#808090",
          "gray-400": "#a3a3b0",
          "gray-300": "#d4d4dc",
          "gray-200": "#e5e5ea",
          white: "#ffffff",
          cyan: "#00d4ff",
          "cyan-dim": "#0099bb",
          "cyan-glow": "rgba(0, 212, 255, 0.15)",
          green: "#3fb950",
          "green-dim": "#2ea043",
          red: "#f85149",
          "red-dim": "#da3633",
          yellow: "#d29922",
          purple: "#a371f7",
          blue: "#388bfd",
          border: "#1e1e2e",
          "border-light": "#2a2a3e",
          "border-accent": "#00d4ff22",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
