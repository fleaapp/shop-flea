import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.FLEA_BUILD_ID ?? Date.now().toString()),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(
      process.env.FLEA_BUILD_DATE ?? new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'),
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libraries into their own chunks so the
        // initial index chunk stays small on mobile networks and updates
        // don't force users to re-download unchanged vendor code.
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@stripe')) return 'vendor-stripe';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (
              id.includes('@radix-ui') ||
              id.includes('@floating-ui') ||
              id.includes('class-variance-authority') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge')
            ) {
              return 'vendor-ui';
            }
            return 'vendor';
          }
        },
      },
    },
  },
}));
