import { defineConfig } from "vite";

// Port 5188 is assigned in C:\Claude\PORTS.md. base "./" lets Electron load dist/ via file://.
export default defineConfig({
  base: "./",
  build: { rollupOptions: { input: { main: "index.html", panel: "panel.html" } } },
  server: { host: "127.0.0.1", port: 5188, strictPort: true },
});
