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

// The showcase (`--mode showcase`) is a web page on made-up data: dist-showcase/index.html, kept out of search engines.
const noIndex = (): Plugin => ({
  name: 'no-index',
  transformIndexHtml: (html) => html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />'),
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), viteSingleFile(), ...(mode === 'showcase' ? [noIndex()] : [renameOutput()])],
  build: mode === 'showcase' ? { outDir: 'dist-showcase' } : undefined,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
