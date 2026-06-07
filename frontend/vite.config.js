import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// COOP/COEP headers are REQUIRED for WebContainer (SharedArrayBuffer)
const crossOriginIsolation = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  plugins: [react()],
  server: {
    headers: crossOriginIsolation,
  },
  preview: {
    headers: crossOriginIsolation,
  },
});
