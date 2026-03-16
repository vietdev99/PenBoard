import { defineConfig } from 'vitest/config'
import path from 'node:path'

const srcDir = path.resolve(
  // @ts-ignore - Bun exposes import.meta.dir, Node uses __dirname
  typeof import.meta.dir === 'string' ? import.meta.dir : __dirname,
  './src',
)

export default defineConfig({
  test: {
    teardownTimeout: 1000,
    environment: 'node',
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
})
