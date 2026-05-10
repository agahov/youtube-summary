import { z } from "zod";

export const OpenAIConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default("gpt-4o-mini"),
});

export const AnthropicConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default("claude-sonnet-4-5"),
});

export const OllamaConfigSchema = z.object({
  model: z.string().default("qwen3-coder:30b"),
  baseUrl: z.string().default("http://localhost:11434"),
  requestTimeout: z.number().int().positive().default(300_000),
});

export const ConfigSchema = z.object({
  vaultPath: z.string(),
  targetFolder: z.string().default("YouTube"),
  languagePriority: z.array(z.string()).default(["en"]),
  includeTranscript: z.boolean().default(true),
  provider: z.enum(["openai", "anthropic", "ollama"]).default("openai"),
  openai: OpenAIConfigSchema.optional(),
  anthropic: AnthropicConfigSchema.optional(),
  ollama: OllamaConfigSchema.optional(),
  cookiesFromBrowser: z.string().optional(),
  cookiesFile: z.string().optional(),
  ytDlpExtraArgs: z.array(z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const VideoMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().default(null),
  channel: z.string().optional(),
  uploader: z.string().optional(),
  upload_date: z.string().optional(),
  duration: z.number().optional(),
  thumbnail: z.string().optional(),
  webpage_url: z.string(),
  tags: z.array(z.string()).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
  view_count: z.number().optional(),
  like_count: z.number().optional(),
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;
