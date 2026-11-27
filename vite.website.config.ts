import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// The public website (invojka.cz): website/index.html with its code in src/website/, built into dist-website/.
// It reuses the app's design kit and components for its animated scenes, but never the app's store or storage.
export default defineConfig({
  root: 'website',
  base: './',
  plugins: [react(), tailwindcss()],
  // Two pages from the same code: Czech at the root, English in en/ (src/website/locale.ts reads the page's lang).
  build: { outDir: '../dist-website', emptyOutDir: true, rollupOptions: { input: { cs: fileURLToPath(new URL('./website/index.html', import.meta.url)), en: fileURLToPath(new URL('./website/en/index.html', import.meta.url)) } } },
  server: { port: 5183 },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
