import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ReturnTag",
        short_name: "ReturnTag",
        description: "QR tags for your belongings. Finders can reach you without ever seeing your contact details.",
        theme_color: "#121311",
        background_color: "#f4f2ec",
        display: "standalone",
        start_url: "/dashboard",
        scope: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Offline app shell: any page navigation falls back to the cached index.html.
        // API responses are never cached, so owners and finders always see fresh messages.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Adds the push + notificationclick handlers to the generated service worker
        importScripts: ["push-sw.js"],
      },
    }),
  ],
  server: {
    // Listen on the LAN too, so a phone on the same Wi-Fi can open scanned dev QR codes
    host: true,
    // In development, /api calls go to the Express server so we don't need CORS locally
    proxy: {
      "/api": "http://localhost:8001",
    },
  },
});
