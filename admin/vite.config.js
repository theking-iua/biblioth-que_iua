import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Appli admin (personnel) — http://localhost:5173
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173 },
});
