import tailwindcssAnimate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

/**
 * Composed Professional — see docs/DESIGN_SYSTEM.md.
 *
 * Two deliberate global overrides:
 *  - `borderRadius` is a small, closed scale. Softened corners replace the
 *    zero-radius rule the first prototype shipped with: the flat squares read
 *    as unfinished rather than as restraint. The scale is closed so a stray
 *    `rounded-3xl` can't introduce a curve the rest of the app doesn't use.
 *  - `spacing` is left at Tailwind's default 4px scale, which is a clean
 *    superset of the 8px grid the spec asks for (use even-numbered steps).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "8px",
      lg: "9px",
      xl: "12px",
      "2xl": "16px",
      "3xl": "16px",
      full: "9999px",
    },
    extend: {
      fontFamily: {
        // Editorial serif for hierarchy, high-readability sans for data.
        display: ['"Playfair Display"', "Georgia", "ui-serif", "serif"],
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        /** Deep charcoal — branding marks and the active-nav indicator. */
        ink: "hsl(var(--ink))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        divider: "hsl(var(--divider))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          active: "hsl(var(--sidebar-active))",
          muted: "hsl(var(--sidebar-muted))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      boxShadow: {
        // Low-elevation, soft blur. Nothing heavier than this in the app.
        card: "0 1px 2px 0 rgb(16 24 40 / 0.05)",
        // Raised surfaces that sit over the page: dropdowns, dialogs.
        pop: "0 12px 32px -12px rgb(16 24 40 / 0.22), 0 2px 6px -2px rgb(16 24 40 / 0.08)",
        drawer: "-20px 0 60px -20px rgb(16 24 40 / 0.28)",
        // Inner top-light on filled buttons, so they read as pressable.
        button: "0 1px 2px 0 rgb(16 24 40 / 0.10), inset 0 -1px 0 0 rgb(0 0 0 / 0.14)",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 180ms cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
