import { z } from "zod";

// Parsed lazily (not at import time) so `next build` never fails just because
// an optional key like ANTHROPIC_API_KEY isn't set yet.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),

  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  LLM_MODEL: z.string().default("claude-sonnet-5"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  EMBEDDING_PROVIDER: z.enum(["openai"]).default("openai"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("AI Job Finder <jobs@yourdomain.com>"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),

  // "local" only works where the filesystem persists across requests (a
  // self-hosted server, a Docker volume) — never on serverless platforms
  // like Vercel, which needs STORAGE_DRIVER=vercel-blob set explicitly
  // (plus a linked Blob store, which injects BLOB_READ_WRITE_TOKEN).
  STORAGE_DRIVER: z.enum(["local", "vercel-blob", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./data/uploads"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),

  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid/missing environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}\nSee .env.example.`,
    );
  }
  cached = parsed.data;
  return cached;
}
