import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.VITE_DEV_PORT || 5174);
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8002';
  const enableFastRefresh = env.VITE_DISABLE_FAST_REFRESH !== '1';

  return {
    server: {
      port: devPort,
      strictPort: true,
      host: '127.0.0.1',
      hmr: enableFastRefresh ? undefined : false,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: devPort,
      strictPort: true,
      host: '127.0.0.1',
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              if (
                id.includes('/components/CustomerRequestManagementHub')
                || id.includes('/components/customer-request/')
              ) {
                return 'customer-request';
              }

              if (
                id.includes('/components/FeeCollectionHub')
                || id.includes('/components/fee-collection/')
              ) {
                return 'fee-collection';
              }

              if (
                id.includes('/components/RevenueManagementHub')
                || id.includes('/components/revenue-mgmt/')
              ) {
                return 'revenue-mgmt';
              }

              return undefined;
            }

            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'react-vendor';
            }

            if (id.includes('/motion/') || id.includes('/framer-motion/')) {
              return 'motion-vendor';
            }

            if (id.includes('/lucide-react/')) {
              return 'icons-vendor';
            }

            if (
              id.includes('/@tanstack/react-query/')
              || id.includes('/@tanstack/query-core/')
              || id.includes('/@tanstack/react-virtual/')
              || id.includes('/@tanstack/virtual-core/')
            ) {
              return 'tanstack-vendor';
            }

            return 'vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
