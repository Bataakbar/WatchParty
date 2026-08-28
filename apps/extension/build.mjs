import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: {
    content: "src/content/content.ts",
    "service-worker": "src/background/service-worker.ts",
    popup: "src/popup/popup.tsx",
  },
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
  minify: false,
  logLevel: "info",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
cpSync("src/icons", "dist/icons", { recursive: true });
