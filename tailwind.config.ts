import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c("--bg"),
        surface: c("--surface"),
        elevated: c("--elevated"),
        border: c("--border"),
        text: c("--text"),
        muted: c("--muted"),
        primary: c("--primary"),
        primaryFg: c("--primary-fg"),
        primaryDark: c("--primary-dark"),
        accent: c("--accent"),
        norge: c("--norge"),
        gold: c("--gold"),
        success: c("--success"),
        danger: c("--danger"),
        warning: c("--warning"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
