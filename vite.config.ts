/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Only expose public-safe env vars; never leak API keys to client bundle
      'process.env.GEMINI_API_KEY': JSON.stringify(''),
    },
    resolve: {
      alias: {
        '@/*': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react', 'motion', 'recharts'],
            utils: ['date-fns', 'zod'],
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 1000,
      sourcemap: 'hidden',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test-setup.ts',
      include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    },
    server: {
      hmr: { overlay: true },
      watch: {
        usePolling: false,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true
        }
      }
    },
  };
});
