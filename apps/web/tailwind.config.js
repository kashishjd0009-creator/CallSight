/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0b0f1a",
        "bg-card": "#111827",
        "bg-card2": "#141e2e",
        "bg-hover": "#1a2540",
        "border-base": "#1e2d45",
        "accent-blue": "#3b82f6",
        "accent-amber": "#f59e0b",
        "accent-green": "#10b981",
        "accent-red": "#ef4444",
        "accent-purple": "#8b5cf6",
        "text-primary": "#f0f4ff",
        "text-secondary": "#7e9abd",
        "text-muted": "#4a6080",
      },
      fontFamily: {
        // Multi-word names must be quoted or CSS treats "EB" and "Garamond" as two families → sans fallback wins.
        sans: ['"EB Garamond"', "Georgia", "ui-serif", "serif"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};
