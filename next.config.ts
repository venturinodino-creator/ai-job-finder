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
  // node_modules. @napi-rs/canvas is a native (N-API) module providing the
  // DOMMatrix/ImageData/Path2D polyfills pdf.js needs — same requirement.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // The serverless file tracer only follows static imports. pdf.js loads two
  // things dynamically that it can't see: @napi-rs/canvas (required inside a
  // try/catch, plus its native linux-x64 binary — what Vercel functions run
  // on) and its own pdf.worker.mjs (imported via a computed path). Without
  // these, PDF uploads fail with "Cannot find module". Force-include them
  // for the one route that parses CVs.
  outputFileTracingIncludes: {
    "/api/cv": [
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "./node_modules/pdfjs-dist/**",
    ],
  },
};

export default nextConfig;
