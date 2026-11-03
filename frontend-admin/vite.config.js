import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// On Vercel, VITE_* values are baked in at BUILD time from the project's
// Environment Variables. Fail the Vercel build loudly instead of shipping a
// bundle with dummy Firebase config or an API base URL that has no backend
// behind it (the static site has no /api proxy on Vercel).
const REQUIRED_ON_VERCEL = [
  'VITE_API_BASE_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const assertVercelBuildEnv = (mode) => {
  if (process.env.VERCEL !== '1') return;
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const missing = REQUIRED_ON_VERCEL.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`[vercel] Missing build-time env vars: ${missing.join(', ')}. Set them in Vercel > Project > Settings > Environment Variables and redeploy.`);
  }
  if (!/^https:\/\//.test(env.VITE_API_BASE_URL)) {
    throw new Error('[vercel] VITE_API_BASE_URL must be the absolute backend URL, e.g. https://<backend-project>.vercel.app/api');
  }
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertVercelBuildEnv(mode);
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
      },
    },
    preview: {
      port: 3001,
      host: '0.0.0.0',
    },
  };
});
