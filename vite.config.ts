import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  console.log('[Vite Config] VITE_COMFY_URL:', env.VITE_COMFY_URL);
  console.log('[Vite Config] VITE_COMFY_URL_STANDARD:', env.VITE_COMFY_URL_STANDARD);
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/comfyui-standard': {
          target: env.VITE_COMFY_URL_STANDARD || 'http://localhost:8189',
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/comfyui-standard/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[Proxy Request Standard] ', req.method, req.url, ' -> ', options.target + proxyReq.path);
            });
          }
        },
        '/comfyui': {
          target: (() => {
            if (!env.VITE_COMFY_URL && mode === 'development') {
              console.warn('⚠️ WARNING: VITE_COMFY_URL is missing in .env.local! Using fallback but connection may fail.');
              return 'http://localhost:8188';
            }
            return env.VITE_COMFY_URL;
          })(),
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/comfyui/, '')
        }
      }
    },
    preview: {
      proxy: {
        '/comfyui': {
          target: env.VITE_COMFY_URL || 'http://localhost:8188',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/comfyui/, '')
        },
        '/comfyui-standard': {
          target: env.VITE_COMFY_URL_STANDARD || 'http://localhost:8189',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/comfyui-standard/, '')
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
