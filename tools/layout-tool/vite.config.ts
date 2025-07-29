import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@canvas': path.resolve(__dirname, 'src/canvas'),
      '@io': path.resolve(__dirname, 'src/io'),
      '@presets': path.resolve(__dirname, 'src/presets')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
});
