/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        topcit: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8ec1ff',
          400: '#599cff',
          500: '#3478f6',
          600: '#1e58e0',
          700: '#1745b8',
          800: '#173a93',
          900: '#183676',
        },
      },
    },
  },
  plugins: [],
}
