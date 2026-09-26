import { defineConfig } from 'vite';
export default defineConfig({ root: 'app', server: { host: '0.0.0.0', proxy: {
  '/api': 'http://localhost:3000', '/health': 'http://localhost:3000'
} }, build: { outDir: 'dist', emptyOutDir: true } });
