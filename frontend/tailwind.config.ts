import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
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
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: "#FAF7F0",
            foreground: "#161B28",
            primary: { DEFAULT: "#B24A29", foreground: "#FFFFFF" },
            secondary: { DEFAULT: "#3A6B4C", foreground: "#FFFFFF" },
            success: { DEFAULT: "#3A6B4C", foreground: "#FFFFFF" },
            warning: { DEFAULT: "#BF852E", foreground: "#FFFFFF" },
            danger: { DEFAULT: "#A9362E", foreground: "#FFFFFF" },
            default: {
              50: "#FAF7F0",
              100: "#F3EEE0",
              200: "#E8E2D5",
              300: "#CEC5B2",
              400: "#7A8394",
              500: "#3F495E",
              600: "#2A3247",
              700: "#1E2538",
              800: "#161B28",
              900: "#0F1420",
              DEFAULT: "#E8E2D5",
              foreground: "#161B28",
            },
            focus: "#B24A29",
          },
          layout: {
            radius: { small: "6px", medium: "8px", large: "12px" },
            borderWidth: { small: "1px", medium: "1px", large: "2px" },
          },
        },
        dark: {
          colors: {
            background: "#07090F",
            foreground: "#F1F3F8",
            primary: { DEFAULT: "#D6794D", foreground: "#FFFFFF" },
            secondary: { DEFAULT: "#7FA067", foreground: "#FFFFFF" },
            success: { DEFAULT: "#7FA067", foreground: "#FFFFFF" },
            warning: { DEFAULT: "#DDA33F", foreground: "#FFFFFF" },
            danger: { DEFAULT: "#D85A4E", foreground: "#FFFFFF" },
            default: {
              50: "#141824",
              100: "#1C2234",
              200: "#252D45",
              300: "#323B58",
              400: "#7E88A3",
              500: "#A9B2CA",
              600: "#C7CDDE",
              700: "#DEE2EE",
              800: "#EDF0F7",
              900: "#F5F7FB",
              DEFAULT: "#252D45",
              foreground: "#F1F3F8",
            },
            focus: "#D6794D",
            content1: "#141824",
            content2: "#1C2234",
            content3: "#252D45",
            content4: "#323B58",
            divider: "rgba(231,237,251,0.12)",
          },
          layout: {
            radius: { small: "6px", medium: "8px", large: "12px" },
          },
        },
      },
    }),
  ],
};

export default config;
