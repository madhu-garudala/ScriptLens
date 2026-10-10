import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        shell: "#101827",
        surface: "#F8FAFC",
        teal: { DEFAULT: "#0F766E", soft: "#CCFBF1" },
        amber: { DEFAULT: "#B45309", soft: "#FEF3C7" },
        danger: { DEFAULT: "#B91C1C", soft: "#FEE2E2" },
      },
    },
  },
  plugins: [],
};
export default config;
