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
        frame: "var(--frame)",
        lime: "var(--lime)",
        coral: "var(--coral)",
        sky: "var(--sky)",
        yolk: "var(--yolk)",
        mint: "var(--mint)",
        bubblegum: "var(--bubblegum)",
        ocean: "#118AB2",
        surface: "var(--surface)",
        muted: "var(--muted)",
      },
      fontFamily: {
        display: ["var(--font-archivo-black)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      boxShadow: {
        brutal: "5px 5px 0px var(--frame)",
        "brutal-sm": "3px 3px 0px var(--frame)",
        "brutal-lg": "8px 8px 0px var(--frame)",
        "brutal-pressed": "2px 2px 0px var(--frame)",
      },
    },
  },
  plugins: [],
} satisfies Config;
