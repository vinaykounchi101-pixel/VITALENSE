/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-canvas)",
        surface: {
          DEFAULT: "var(--color-surface)",
          elevated: "var(--color-surface-elevated)",
          subtle: "var(--color-surface-subtle)",
        },
        sidebar: "var(--color-sidebar)",
        border: "var(--color-border)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        brand: {
          DEFAULT: "var(--color-brand)",
          soft: "var(--color-teal-soft)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          text: "var(--color-primary-text)",
        },
        coral: {
          DEFAULT: "var(--color-coral)",
          soft: "var(--color-coral-soft)",
        },
        mint: {
          DEFAULT: "var(--color-mint)",
          soft: "var(--color-mint-soft)",
        },
        lavender: {
          DEFAULT: "var(--color-lavender)",
          soft: "var(--color-lavender-soft)",
        },
        blue: {
          DEFAULT: "var(--color-blue)",
          soft: "var(--color-blue-soft)",
        },
        peach: {
          DEFAULT: "var(--color-peach)",
          soft: "var(--color-peach-soft)",
        },
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        positive: "var(--color-positive)",
      },
      borderRadius: {
        xs: "7px",
        sm: "11px",
        md: "15px",
        lg: "19px",
        xl: "25px",
        pill: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "Manrope", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1480px",
      },
      spacing: {
        "sidebar-desktop": "142px",
        "header-desktop": "60px",
      },
    },
  },
  plugins: [],
};
