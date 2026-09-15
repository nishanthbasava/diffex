import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  /**
   * 🔑 CRITICAL FIX:
   * Allow top-level await (needed by pdfjs-dist)
   */
  esbuild: {
    target: "es2022",
  },

  build: {
    target: "es2022",
  },
}));
