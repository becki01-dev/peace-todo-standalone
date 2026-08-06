import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Priority: real process.env (CI/deploy platform) > .env file (local dev)
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set. " +
        "Copy .env.example to .env and fill in your Supabase project credentials."
    );
  }

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        supabasePublishableKey
      ),
    },
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
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
