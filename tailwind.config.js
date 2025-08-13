/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {
      colors: {
        background: '#2b2b2b', // Main background
        panel: '#3c3f41',      // Panels and cards
        textPrimary: '#ffffff',
        textSecondary: '#bbbbbb',
        accent: '#4ec9b0',     // PyCharm green
        accentHover: '#3ba393'
      }
    } },
  plugins: [],
};
