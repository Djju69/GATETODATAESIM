import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F14",
        surface: "#121821",
        raised: "#1A2230",
        line: "#243041",
        fg: "#F2F5F8",
        muted: "#93A1B1",
        signal: "#00E5A0",
        "signal-dark": "#00C98C",
        sky: "#4D8BFF",
        danger: "#FF5C6C",
        warn: "#FFB454",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.125rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,229,160,.18), 0 12px 40px -12px rgba(0,229,160,.25)",
        card: "0 18px 50px -24px rgba(0,0,0,.7)",
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".45", transform: "scale(.82)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 2.2s ease-in-out infinite",
        rise: "rise .5s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
