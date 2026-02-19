import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        lime: "#BAFF39",
        coral: "var(--coral)",
        sky: "#67E8F9",
        yolk: "#FFD166",
        mint: "#06D6A0",
        ocean: "#118AB2",
        bubblegum: "#EF476F",
        surface: "var(--surface)",
        muted: "var(--muted)",
      },
      fontFamily: {
        display: ["var(--font-archivo-black)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      boxShadow: {
        brutal: "5px 5px 0px var(--ink)",
        "brutal-sm": "3px 3px 0px var(--ink)",
        "brutal-lg": "8px 8px 0px var(--ink)",
        "brutal-pressed": "2px 2px 0px var(--ink)",
      },
    },
  },
  plugins: [],
} satisfies Config;
