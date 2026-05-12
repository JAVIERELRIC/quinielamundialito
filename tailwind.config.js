/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: { DEFAULT: '#1D9E75', dark: '#085041', light: '#E1F5EE' },
        azul: { DEFAULT: '#185FA5', dark: '#0C447C', light: '#E6F1FB' },
      },
    },
  },
  plugins: [],
}
