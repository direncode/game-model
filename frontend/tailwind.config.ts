import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        li: {
          // Core blacks
          black: "#000000",
          "black-light": "#0a0a0a",
          "black-elevated": "#111111",
          "black-surface": "#171717",
          // Grays
          "gray-900": "#1a1a1a",
          "gray-800": "#262626",
          "gray-700": "#404040",
          "gray-600": "#525252",
          "gray-500": "#737373",
          "gray-400": "#a3a3a3",
          "gray-300": "#d4d4d4",
          "gray-200": "#e5e5e5",
          "gray-100": "#f5f5f5",
          white: "#ffffff",
          // Accents
          cyan: "#00d4ff",
          green: "#3fb950",
          red: "#f85149",
          yellow: "#d29922",
          purple: "#a371f7",
          blue: "#388bfd",
          // Depth system (btut.ai-inspired gradient backgrounds)
          "depth-1": "#050508",
          "depth-2": "#0a0a10",
          "depth-3": "#0f0f18",
          // Warm contrast (editorial serif accent)
          warm: "#c9a96e",
          "warm-muted": "#8a7752",
          // Scientific green
          science: "#2b5e49",
          "science-light": "#3d8b6a",
          // Semantic aliases (backward compatibility with existing pages)
          bg: "#000000",
          surface: "#0a0a0a",
          "surface-hover": "#111111",
          primary: "#00d4ff",
          "primary-hover": "#00b8e6",
          accent: "#3fb950",
          "accent-hover": "#2ea043",
          warning: "#d29922",
          danger: "#f85149",
          "danger-hover": "#da3633",
          border: "#1a1a1a",
          "border-light": "#262626",
          "border-accent": "#1a1a2e",
          "text-primary": "#ffffff",
          "text-secondary": "#a3a3a3",
          "text-muted": "#525252",
          "text-tertiary": "#737373",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "Times New Roman", "serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
        // Semantic aliases
        body: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "Times New Roman", "serif"],
        data: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
      fontSize: {
        // Display / Hero sizes (Instrument Serif targets)
        hero: ["clamp(3.5rem, 10vw, 7rem)", { lineHeight: "1.04", letterSpacing: "-0.03em", fontWeight: "400" }],
        "hero-sub": ["clamp(1.25rem, 3vw, 1.75rem)", { lineHeight: "1.5", letterSpacing: "-0.01em", fontWeight: "300" }],
        section: ["clamp(2rem, 5vw, 3.5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "400" }],
        "section-sub": ["clamp(1.125rem, 2vw, 1.375rem)", { lineHeight: "1.5", letterSpacing: "0em", fontWeight: "400" }],
        counter: ["clamp(3rem, 8vw, 5rem)", { lineHeight: "1", letterSpacing: "-0.04em", fontWeight: "400" }],
        // Data display sizes (JetBrains Mono targets)
        "data-lg": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "500" }],
        "data-md": ["0.875rem", { lineHeight: "1.4", letterSpacing: "0em", fontWeight: "400" }],
        "data-sm": ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "400" }],
      },
      spacing: {
        section: "8rem",
        "section-lg": "12rem",
        "section-xl": "16rem",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "line-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "reveal-line": {
          "0%": { width: "0" },
          "100%": { width: "60px" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 212, 255, 0)" },
          "50%": { boxShadow: "0 0 20px 2px rgba(0, 212, 255, 0.15)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.8s ease forwards",
        "fade-in": "fade-in 0.6s ease forwards",
        "slide-in-left": "slide-in-left 0.8s ease forwards",
        "line-grow": "line-grow 0.8s ease forwards",
        float: "float 3s ease-in-out infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "reveal-line": "reveal-line 0.8s ease forwards",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
