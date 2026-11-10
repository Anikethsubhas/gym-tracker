import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // The browser talks to the Vite server only, so the login cookie stays same-origin.
    proxy: { '/api': 'http://localhost:4000' },
  },
  // Optimize package imports - eliminates barrel import cost for large libraries
  optimizeDeps: {
    include: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-slot',
      '@radix-ui/react-label',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-switch',
      '@radix-ui/react-alert-dialog',
    ],
  },
});
