/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        claude: {
          bg: '#1a1a1a',
          sidebar: '#111111',
          card: '#242424',
          border: '#333333',
          accent: '#d4a574',
          text: '#e5e5e5',
          muted: '#888888',
          hover: '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
}
