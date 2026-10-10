import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        shell: "#101827",
        surface: "#F6F7F9",
        teal: { DEFAULT: "#0D9488", soft: "#CCFBF1" },
        amber: { DEFAULT: "#B45309", soft: "#FEF3C7" },
        danger: { DEFAULT: "#B91C1C", soft: "#FEE2E2" },
      },
    },
  },
  plugins: [],
};
export default config;
