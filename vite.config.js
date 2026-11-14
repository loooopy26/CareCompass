import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// .env의 백엔드 주소 (끝의 /v1은 떼어 냄). 개발 서버가 /v1 요청을 이 주소로 전달해서 브라우저 CORS가 필요 없음
const api = loadEnv('development', fileURLToPath(new URL('.', import.meta.url)), 'VITE_').VITE_API_URL?.replace(/\/+$/, '').replace(/\/v1$/, '')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: api ? { proxy: { '/v1': { target: api, changeOrigin: true } } } : {},
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
})
