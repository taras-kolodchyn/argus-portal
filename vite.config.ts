import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
