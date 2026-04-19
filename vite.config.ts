import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

/** Copy root `targeticon.jpg` into `public/` so `/targeticon.jpg` works as the favicon (Vite only serves static files from `public/`). */
function copyTargetIconFavicon() {
  return {
    name: "copy-targeticon-favicon",
    buildStart() {
      const src = path.resolve(__dirname, "targeticon.jpg");
      const destDir = path.resolve(__dirname, "public");
      const dest = path.join(destDir, "targeticon.jpg");
      if (!existsSync(src)) {
        console.warn("[copy-targeticon-favicon] Missing ./targeticon.jpg — favicon will 404 until the file exists at the project root.");
        return;
      }
      mkdirSync(destDir, { recursive: true });
      try {
        copyFileSync(src, dest);
      } catch (e) {
        console.warn("[copy-targeticon-favicon]", e);
      }
    },
  };
}

/** Injected into `index.html` as `%SITE_URL%` (canonical + og:url). Set `VITE_SITE_URL` in `.env` or Vercel to any short domain you attach to the project. */
function htmlSiteUrlPlugin(siteUrl: string) {
  return {
    name: "html-site-url",
    transformIndexHtml(html: string) {
      return html.replaceAll("%SITE_URL%", siteUrl);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = env.VITE_SITE_URL?.trim();
  const siteUrl = (
    raw ||
    (mode === "development" ? "http://localhost:8080" : "https://poise.ai")
  ).replace(/\/$/, "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), copyTargetIconFavicon(), htmlSiteUrlPlugin(siteUrl)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
