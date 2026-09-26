import { generateObject, generateText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";
import { getEnv } from "./env";

// Thin, provider-agnostic wrapper around the Vercel AI SDK. Swapping
// LLM_PROVIDER in .env is enough to move every agent (CV parsing, match
// scoring, CV review, CV tailoring) between Anthropic and OpenAI.
function getModel(): LanguageModel {
  const env = getEnv();

  if (env.LLM_PROVIDER === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set (LLM_PROVIDER=anthropic).");
    }
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return anthropic(env.LLM_MODEL);
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (LLM_PROVIDER=openai).");
  }
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai(env.LLM_MODEL);
}

export async function llmText(params: { system?: string; prompt: string }): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    system: params.system,
    prompt: params.prompt,
  });
  return text;
}

/** Ask the model for a value matching `schema`, retrying is handled by the SDK. */
export async function llmObject<T>(params: {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const { object } = await generateObject({
    model: getModel(),
    system: params.system,
    prompt: params.prompt,
    schema: params.schema,
  });
  return object;
}
