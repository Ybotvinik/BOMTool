import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1d4ed8",
          fg: "#ffffff",
          soft: "#eff4ff",
        },
        navy: "#0f1f3d",
        risk: {
          low: "#16a34a",
          medium: "#d97706",
          high: "#dc2626",
          critical: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ["Assistant", "Rubik", "system-ui", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
