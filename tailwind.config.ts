import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      colors: {
        lab: {
          bg: "#0d1117",
          panel: "#151b23",
          panelSoft: "#1f2631",
          line: "#303844",
          text: "#e6edf3",
          muted: "#8b949e",
          cyan: "#38bdf8",
          green: "#34d399",
          amber: "#fbbf24",
          red: "#f87171",
        },
      },
    },
  },
  plugins: [],
};

export default config;
