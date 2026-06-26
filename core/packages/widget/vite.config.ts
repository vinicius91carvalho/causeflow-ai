import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CauseflowWidget',
      formats: ['iife'],
      fileName: () => 'causeflow-widget.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    target: 'es2022',
  },
});
