import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07070b",
        panel: "#111119",
        line: "rgba(255,255,255,0.09)"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(132, 92, 255, 0.22)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: [typography]
} satisfies Config;
