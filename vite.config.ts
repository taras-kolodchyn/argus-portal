import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const httpsConfig = (() => {
  const keyPath = path.resolve(rootDir, "certs/keycloak/tls.key");
  const certPath = path.resolve(rootDir, "certs/keycloak/tls.crt");
  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } catch {
    return undefined;
  }
})();

const securityHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://challenges.cloudflare.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://*.tile.openstreetmap.org; connect-src 'self' https://127.0.0.1:8000 http://127.0.0.1:8000 https://localhost:8000 http://localhost:8000 https://challenges.cloudflare.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://*.tile.openstreetmap.org; font-src 'self' data:; frame-src https://challenges.cloudflare.com; frame-ancestors 'none';",
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    https: httpsConfig,
    headers: securityHeaders,
  },
  preview: {
    https: httpsConfig,
    headers: securityHeaders,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          const matchers: { test: RegExp; chunk: string }[] = [
            {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/,
              chunk: "argus-react",
            },
            {
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
              chunk: "argus-query",
            },
            {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              chunk: "argus-charts",
            },
            {
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              chunk: "argus-maps",
            },
            {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]|class-variance-authority/,
              chunk: "argus-ui",
            },
            {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              chunk: "argus-icons",
            },
            {
              test: /[\\/]node_modules[\\/]react-router(?:-dom)?[\\/]/,
              chunk: "argus-router",
            },
            {
              test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
              chunk: "argus-i18n",
            },
            {
              test: /[\\/]node_modules[\\/]date-fns[\\/]/,
              chunk: "argus-date",
            },
            {
              test: /[\\/]node_modules[\\/]keycloak-js[\\/]/,
              chunk: "argus-auth",
            },
          ];

          for (const { test, chunk } of matchers) {
            if (test.test(id)) {
              return chunk;
            }
          }

          return "argus";
        },
      },
    },
  },
});
