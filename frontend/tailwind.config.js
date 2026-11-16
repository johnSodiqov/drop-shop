/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#18211d',
        green: { 500: '#1e8a5a', 600: '#17754b' },
        canvas: '#f6f8f6',
      },
    },
  },
  plugins: [],
};
