/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'primary': {
          DEFAULT: '#2a5f5f',
          dark: '#1f4a4a',
          light: '#367070'
        },
        'accent': {
          DEFAULT: '#a8d5ba',
          dark: '#8bc4a0',
          light: '#c2e5d3'
        },
        'dark': {
          DEFAULT: '#000000',
          lighter: '#1a1a1a',
          text: '#333333'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
