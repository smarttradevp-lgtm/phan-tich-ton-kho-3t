import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port rieng (5176/8790) de chay song song voi linh-kien-app (5174/8788) khi dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: { "/api": { target: "http://localhost:8790", changeOrigin: true } },
  },
  build: { outDir: "dist" },
});
