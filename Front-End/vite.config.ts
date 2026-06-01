import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "logo-dd.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "apple-touch-icon.png",
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
        // SW novo assume imediatamente após instalar, evitando 404 em assets
        // de hash antigo após deploys consecutivos.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
        background_color: "#ffffff",
        theme_color: "#0a0a0d",
        lang: "pt-BR",
        categories: ["business", "productivity"],
        icons: [
          // PNG é obrigatório pro Android Chrome oferecer a instalação (SVG não conta).
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
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
          icons: ["@heroicons/react"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
