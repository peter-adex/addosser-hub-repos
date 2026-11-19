import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
<<<<<<< HEAD
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
=======
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
<<<<<<< HEAD
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
=======
        primary: {
          DEFAULT: "#FFB800",
          foreground: "#1B2A8A",
        },
        navy: {
          DEFAULT: "#1B2A8A",
          dark: "#121E6B",
          light: "#2C3FAD",
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
<<<<<<< HEAD
        brand: {
          primary: "var(--primary)",
          navy: "var(--navy)",
          "navy-dark": "var(--navy-dark)",
=======
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
<<<<<<< HEAD
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "route-progress": {
          "0%":   { transform: "scaleX(0)",   opacity: "1" },
          "80%":  { transform: "scaleX(0.9)", opacity: "1" },
          "100%": { transform: "scaleX(0.9)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "route-progress": "route-progress 8s cubic-bezier(0.15, 0.8, 0.3, 1) forwards",
=======
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
      fontFamily: {
        sans: ["DM Sans", "Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
