import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F5F0E8",
        ink: "#1a1a1a",
        lime: "#BAFF39",
        coral: "#FF5C5C",
        sky: "#67E8F9",
        yolk: "#FFD166",
        mint: "#06D6A0",
        ocean: "#118AB2",
        bubblegum: "#EF476F",
      },
      fontFamily: {
        display: ["var(--font-archivo-black)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      boxShadow: {
        brutal: "5px 5px 0px #1a1a1a",
        "brutal-sm": "3px 3px 0px #1a1a1a",
        "brutal-lg": "8px 8px 0px #1a1a1a",
        "brutal-pressed": "2px 2px 0px #1a1a1a",
      },
    },
  },
  plugins: [],
} satisfies Config;
