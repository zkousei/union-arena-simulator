/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ua: {
          bg: '#0f172a',
          board: '#1e293b',
          card: '#334155',
          accent: '#3b82f6',
          energy: '#10b981',
          ap: '#f59e0b',
          life: '#ef4444',
          highlight: '#8b5cf6',
        }
      }
    },
  },
  plugins: [],
}
