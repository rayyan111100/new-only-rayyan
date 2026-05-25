/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      colors: {
        soc: {
          bg: '#f0f2f5', panel: '#ffffff', sidebar: '#ffffff', blue: '#3b82f6', hover: '#2563eb',
          border: '#e5e7eb', text: '#1a1c23', stext: '#6b7280', green: '#10b981', blue2: '#60a5fa',
          darkbg: '#0f1117', darkpanel: '#1a1d27', darkside: '#0f1117',
          darkborder: '#2d3140', darktext: '#e4e6eb', darkstext: '#9ca3af',
        }
      },
      fontSize: { xxs: ['10px', '13px'] },
      borderRadius: { 'gm': '8px', 'gm-sm': '4px' }
    }
  },
  plugins: []
}
