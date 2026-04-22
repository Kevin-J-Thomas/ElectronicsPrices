import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Public — warm editorial
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          faint: "rgb(var(--color-ink-faint) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--color-line) / <alpha-value>)",
          strong: "rgb(var(--color-line-strong) / <alpha-value>)",
        },
        sienna: {
          DEFAULT: "rgb(var(--color-sienna) / <alpha-value>)",
          muted: "rgb(var(--color-sienna-muted) / <alpha-value>)",
          tint: "rgb(var(--color-sienna-tint) / <alpha-value>)",
        },
        sage: "rgb(var(--color-sage) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        crimson: "rgb(var(--color-crimson) / <alpha-value>)",

        // Admin — deep precise console
        console: {
          bg: "rgb(var(--color-console-bg) / <alpha-value>)",
          panel: "rgb(var(--color-console-panel) / <alpha-value>)",
          line: "rgb(var(--color-console-line) / <alpha-value>)",
          hover: "rgb(var(--color-console-hover) / <alpha-value>)",
          active: "rgb(var(--color-console-active) / <alpha-value>)",
          ink: "rgb(var(--color-console-ink) / <alpha-value>)",
          muted: "rgb(var(--color-console-muted) / <alpha-value>)",
          faint: "rgb(var(--color-console-faint) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
      letterSpacing: {
        editorial: "0.18em",
      },
      boxShadow: {
        hairline: "0 0 0 1px rgb(var(--color-line) / 0.8)",
        soft: "0 1px 2px 0 rgb(30 30 30 / 0.04), 0 1px 1px 0 rgb(30 30 30 / 0.03)",
        lift: "0 8px 24px -8px rgb(30 30 30 / 0.08), 0 2px 6px -2px rgb(30 30 30 / 0.06)",
        glow: "0 0 0 3px rgb(var(--color-sienna) / 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "slide-up-delay-1": "slideUp 0.5s 0.05s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "slide-up-delay-2": "slideUp 0.5s 0.1s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "slide-up-delay-3": "slideUp 0.5s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.9)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
