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

          if (id.includes("react-dom") || id.includes("react/jsx-runtime")) {
            return "argus-react";
          }

          if (id.includes("@tanstack")) {
            return "argus-query";
          }

          if (id.includes("recharts")) {
            return "argus-charts";
          }

          if (id.includes("leaflet") || id.includes("react-leaflet")) {
            return "argus-maps";
          }

          if (id.includes("@radix-ui") || id.includes("class-variance-authority")) {
            return "argus-ui";
          }

          return "argus";
        },
      },
    },
  },
});
