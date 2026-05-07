import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        mist: "#f4f7f5",
        leaf: "#2f7d57",
        tomato: "#d95d39",
        steel: "#44515f"
      },
      boxShadow: {
        soft: "0 18px 40px rgba(23, 33, 43, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
