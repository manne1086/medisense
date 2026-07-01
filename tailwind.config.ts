import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-container-highest': '#d3e4fe',
        'surface-container': '#e5eeff',
        surface: '#f8f9ff',
        'tertiary-container': '#007369',
        'inverse-on-surface': '#eaf1ff',
        'surface-bright': '#f8f9ff',
        'on-secondary-fixed-variant': '#384953',
        'on-error-container': '#93000a',
        'tertiary-fixed': '#89f5e7',
        'surface-tint': '#004ced',
        'surface-dim': '#cbdbf5',
        'on-tertiary-fixed': '#00201d',
        primary: '#003ec7',
        'on-tertiary-container': '#8bf7e9',
        'secondary-fixed-dim': '#b7c9d5',
        'error-container': '#ffdad6',
        'surface-container-lowest': '#ffffff',
        'surface-variant': '#d3e4fe',
        'tertiary-fixed-dim': '#6bd8cb',
        'primary-fixed': '#dde1ff',
        'surface-container-high': '#dce9ff',
        'primary-container': '#0052ff',
        'inverse-primary': '#b7c4ff',
        'surface-container-low': '#eff4ff',
        'on-tertiary-fixed-variant': '#005049',
        background: '#f8f9ff',
        'on-primary': '#ffffff',
        'on-primary-fixed': '#001452',
        'on-error': '#ffffff',
        'on-secondary-fixed': '#0c1e26',
        'on-tertiary': '#ffffff',
        'primary-fixed-dim': '#b7c4ff',
        'inverse-surface': '#213145',
        error: '#ba1a1a',
        'outline-variant': '#c3c5d9',
        tertiary: '#005851',
        outline: '#737688',
        'on-secondary-container': '#566771',
        'on-surface': '#0b1c30',
        'on-primary-container': '#dfe3ff',
        'secondary-fixed': '#d3e5f1',
        'on-secondary': '#ffffff',
        'on-primary-fixed-variant': '#0038b6',
        'secondary-container': '#d3e5f1',
        secondary: '#50616b',
        'on-surface-variant': '#434656',
        'on-background': '#0b1c30',
        glass: 'rgba(255, 255, 255, 0.25)',
        glassBorder: 'rgba(255, 255, 255, 0.3)',
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        brandBlue: '#008AD1'
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px'
      },
      spacing: {
        unit: '8px',
        'section-gap': '80px',
        'margin-x': '32px',
        gutter: '24px',
        'container-max': '1280px'
      },
      fontFamily: {
        h3: ['Epilogue'],
        'label-sm': ['Manrope'],
        'body-lg': ['Manrope'],
        h1: ['Epilogue'],
        h2: ['Epilogue'],
        'body-md': ['Manrope'],
        epilogue: ['Epilogue', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        sans: ['Manrope', 'sans-serif']
      },
      fontSize: {
        h3: ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'label-sm': ['13px', { lineHeight: '1.0', letterSpacing: '0.05em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        h1: ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }]
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      }
    }
  },
  plugins: [forms, containerQueries, tailwindcssAnimate]
};

export default config;
