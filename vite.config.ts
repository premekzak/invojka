import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// The source template is index.html; the distributable is a single dist/invojka.html.
const renameOutput = (): Plugin => ({
  name: 'rename-output',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html']
    if (html) {
      html.fileName = 'invojka.html'
    }
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), renameOutput()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
