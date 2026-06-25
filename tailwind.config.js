/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      colors: {
        soc: {
          bg: '#f5f6fa', panel: '#ffffff', sidebar: '#ffffff',
          blue: '#324059', hover: '#EF843C',
          border: '#e8eaed', text: '#324059', stext: '#5f6368',
          green: '#34a853', blue2: '#EF843C',
          darkbg: '#1a1f2e', darkpanel: '#1e2337', darkside: '#151a28',
          darkborder: '#2a3042', darktext: '#e4e6eb', darkstext: '#9aa0b0',
          accent: '#EF843C',
        }
      },
      fontSize: { xxs: ['10px', '13px'] },
      borderRadius: { 'gm': '8px', 'gm-sm': '4px' }
    }
  },
  plugins: []
}
