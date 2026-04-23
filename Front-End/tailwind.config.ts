import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Azul principal — baseado na logo (#0086f7 / #008eff)
        brand: {
          50:  "#e6f3ff",
          100: "#cce8ff",
          200: "#99d0ff",
          300: "#66b9ff",
          400: "#33a1ff",
          500: "#008eff",
          600: "#0086f7",
          700: "#006ac4",
          800: "#004f91",
          900: "#00355e",
          950: "#001a30",
        },
        // Amarelo secundário — baseado na logo (#ffb500 / #ffbf00)
        accent: {
          50:  "#fff8e6",
          100: "#fff1cc",
          200: "#ffe499",
          300: "#ffd666",
          400: "#ffc933",
          500: "#ffbf00",
          600: "#ffb500",
          700: "#cc9100",
          800: "#996d00",
          900: "#664800",
          950: "#332400",
        },
        // Paletas de superfície e texto dirigidas por CSS vars — trocam com o tema
        ink: {
          50:  v("--ink-50"),
          100: v("--ink-100"),
          200: v("--ink-200"),
          300: v("--ink-300"),
          400: v("--ink-400"),
          500: v("--ink-500"),
          600: v("--ink-600"),
          700: v("--ink-700"),
          800: v("--ink-800"),
          900: v("--ink-900"),
          950: v("--ink-950"),
        },
        slate: {
          50:  v("--slate-50"),
          100: v("--slate-100"),
          200: v("--slate-200"),
          300: v("--slate-300"),
          400: v("--slate-400"),
          500: v("--slate-500"),
          600: v("--slate-600"),
          700: v("--slate-700"),
          800: v("--slate-800"),
          900: v("--slate-900"),
          950: v("--slate-950"),
        },
        // Tokens semânticos
        surface: v("--surface"),
        "surface-2": v("--surface-2"),
        hairline: v("--hairline"),
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.08)",
        glow: "0 0 0 1px rgba(0, 134, 247, .35), 0 10px 30px rgba(0, 134, 247, .25)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Inter",
          "sans-serif",
        ],
      },
      animation: {
        "fade-in": "fadeIn .25s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        "slide-in-left": "slideInLeft .22s cubic-bezier(0.32, 0.72, 0, 1) both",
        "slide-in-bottom": "slideInBottom .22s cubic-bezier(0.32, 0.72, 0, 1) both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideInBottom: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
