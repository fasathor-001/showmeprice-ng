import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#0F766E", // teal-500 (ShowMePrice brand)
      },
    },
  },
  plugins: [],
} satisfies Config;
