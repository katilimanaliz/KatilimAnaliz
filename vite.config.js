import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'window.__ANTHROPIC_KEY__': JSON.stringify(process.env.VITE_ANTHROPIC_KEY || ''),
  },
})
