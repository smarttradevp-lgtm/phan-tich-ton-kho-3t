/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Be Vietnam Pro", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        primary: "var(--color-primary)",
        "primary-soft": "var(--color-primary-soft)",
        bg: "var(--color-background)",
        surface: "var(--color-surface)",
        subtle: "var(--color-subtle)",
        ink: "var(--color-text)",
        "ink-soft": "var(--color-text-secondary)",
        line: "var(--color-border)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },
    },
  },
  plugins: [],
};
