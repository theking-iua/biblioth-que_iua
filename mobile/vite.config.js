import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Appli mobile des lecteurs — http://localhost:5174 (accessible depuis un téléphone du même réseau)
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true, host: true },
  preview: { port: 5174, host: true },
});
