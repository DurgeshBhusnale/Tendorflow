import tailwindcssAnimate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

/**
 * Elevated Minimalism — see docs/DESIGN_SYSTEM.md.
 *
 * Two deliberate global overrides:
 *  - `borderRadius` is zeroed across the whole scale, so no `rounded-*` class
 *    anywhere in the app can reintroduce a curve. Sharp corners are a rule of
 *    the design language, not a per-component decision.
 *  - `spacing` is left at Tailwind's default 4px scale, which is a clean
 *    superset of the 8px grid the spec asks for (use even-numbered steps).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
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
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      boxShadow: {
        // Low-elevation, soft blur. Nothing heavier than this in the app.
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        drawer: "-8px 0 24px -12px rgb(0 0 0 / 0.18)",
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
