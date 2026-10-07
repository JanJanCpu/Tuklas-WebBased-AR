import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

// Include lazy imports (Three.js and AR.js) even if no lesson was opened online.
function offlineBundle() {
  let outDir: string;
  return {
    name: "tuklas-offline-bundle",
    apply: "build" as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files: string[] = [];
      async function walk(directory: string) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.isDirectory()) await walk(path);
          else if (entry.name !== "service-worker.js") files.push(path);
        }
      }
      await walk(outDir);
      files.sort();
      const workerPath = resolve(outDir, "service-worker.js");
      const source = await readFile(workerPath, "utf8");
      const hash = createHash("sha256").update(source);
      for (const file of files) hash.update(relative(outDir, file)).update(await readFile(file));
      await writeFile(workerPath, source
        .replace('"__BUILD_VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16)))
        .replace("/* __BUILD_ASSETS__ */", files.map(file => JSON.stringify("/" + relative(outDir, file).replaceAll("\\", "/"))).join(",\n")));
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineBundle()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
