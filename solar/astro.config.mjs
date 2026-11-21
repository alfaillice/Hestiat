import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://hestiat.com",
  output: "static",
  build: { format: "directory" },
  compressHTML: true,
});
