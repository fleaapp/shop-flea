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
        //
        // IMPORTANT: there is deliberately NO catch-all `vendor` chunk here.
        // A catch-all creates circular chunk graphs (vendor -> vendor-react
        // -> vendor), which Rollup cannot order. In production that throws a
        // "cannot access before initialization" error on the very first
        // evaluated module, React never mounts, and the app boots to a blank
        // screen. Unmatched node_modules code stays with the entry that
        // imports it, which is always safe.
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@stripe')) return 'vendor-stripe';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          // Only the genuinely heavy UI primitives. Tiny utilities such as
          // clsx / tailwind-merge / cva are imported by nearly every chunk and
          // must not be isolated, or they form a second cycle.
          if (id.includes('@radix-ui') || id.includes('@floating-ui')) return 'vendor-ui';
        },
      },
    },
  },
}));
