import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  worker: { format: "es" },
  server: {
    // ts-rust's JS glue is imported straight from its submodule.
    fs: { allow: [".", "../ts-rust/npm/wasm"] },
  },
  test: {
    environment: "node",
  },
});
