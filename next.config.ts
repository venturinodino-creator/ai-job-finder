import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly so Turbopack doesn't try to infer it
  // from stray lockfiles higher up the filesystem (e.g. in a home directory).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
