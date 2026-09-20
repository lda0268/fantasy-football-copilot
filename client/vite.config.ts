import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.SEASON_API_ORIGIN ?? "https://localhost:5178",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: process.env.SEASON_API_ORIGIN ?? "https://localhost:5178",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
