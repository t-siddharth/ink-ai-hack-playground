import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const inkEnv = loadEnv(mode, process.cwd(), 'INK_')
  const openrouterEnv = loadEnv(mode, process.cwd(), 'OPENROUTER_')
  const recognitionApiUrl = inkEnv.INK_RECOGNITION_API_URL || 'http://localhost:8080'

  // Accept either INK_OPENROUTER_API_KEY or OPENROUTER_API_KEY (common copy-paste from OpenRouter docs).
  const resolvedOpenRouterKey = (
    inkEnv.INK_OPENROUTER_API_KEY ||
    openrouterEnv.OPENROUTER_API_KEY ||
    ''
  ).trim()

  return {
    envPrefix: 'INK_',
    ...(resolvedOpenRouterKey
      ? {
          define: {
            'import.meta.env.INK_OPENROUTER_API_KEY': JSON.stringify(resolvedOpenRouterKey),
          },
        }
      : {}),
    plugins: [react()],
    server: {
      proxy: {
        '/api/recognition': {
          target: recognitionApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/recognition/, ''),
        },
      },
    },
  }
})
