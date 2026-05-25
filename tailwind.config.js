/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', '"Product Sans"', 'Roboto', '"Segoe UI"', 'Arial', 'sans-serif']
      },
      colors: {
        soc: {
          bg: '#f6f8fc',
          panel: '#ffffff',
          sidebar: '#f6f8fc',
          blue: '#1a73e8',
          hover: '#1557b0',
          border: '#dadce0',
          text: '#202124',
          stext: '#5f6368',
          green: '#188038',
          darkbg: '#1a1a1a',
          darkpanel: '#2d2d2d',
          darkside: '#1a1a1a',
          darkborder: '#3c4043',
          darktext: '#e8eaed',
          darkstext: '#9aa0a6',
        }
      },
      fontSize: {
        xxs: ['11px', '14px'],
      },
      borderRadius: {
        'gm': '8px',
        'gm-sm': '4px',
      }
    }
  },
  plugins: []
}
