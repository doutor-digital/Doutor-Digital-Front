import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "icon-192.svg",
        "icon-512.svg",
        "icon-maskable.svg",
        "apple-touch-icon.svg",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/webhooks\//,
          /^\/contacts\//,
          /^\/logs\//,
          /^\/users\//,
        ],
      },
      manifest: {
        name: "Doutor Digital · Insights",
        short_name: "Doutor Digital",
        description: "Painel de leads, contatos e atendimentos da Doutor Digital.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0a0a0d",
        theme_color: "#0a0a0d",
        lang: "pt-BR",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  esbuild: {
    // Remove logs/debugger do bundle de produção
    drop: ["console", "debugger"],
    legalComments: "none",
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
