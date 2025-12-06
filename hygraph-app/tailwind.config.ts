import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/elements/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Hygraph-inspired colors
        'hygraph-purple': '#6C63FF',
        'hygraph-dark': '#1A1A2E',
        'hygraph-card': '#252542',
        'hygraph-border': '#3D3D5C',
      },
    },
  },
  plugins: [],
};

export default config;

