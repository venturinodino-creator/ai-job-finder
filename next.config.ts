import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly so Turbopack doesn't try to infer it
  // from stray lockfiles higher up the filesystem (e.g. in a home directory).
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdf-parse (pdf.js under the hood) loads its worker script via a path
  // resolved relative to its own package files at runtime. Bundling it into
  // the server chunks breaks that resolution (the worker .mjs never gets
  // emitted alongside the chunk), so it must run unbundled straight out of
  // node_modules.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
