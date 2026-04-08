import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
       background: 'var(--background)',
        card: 'var(--card)',
        elevated: 'var(--elevated)',
        border: 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'accent-primary': 'rgb(var(--accent-primary) / <alpha-value>)',
        'accent-secondary': 'rgb(var(--accent-secondary) / <alpha-value>)',
        'accent-destructive': 'rgb(var(--accent-destructive) / <alpha-value>)',
        'accent-warning': 'rgb(var(--accent-warning) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
export default config;
