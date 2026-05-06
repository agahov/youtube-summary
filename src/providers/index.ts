import type { Config } from "../schemas.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";

export interface SummaryResult {
  mainIdea: string;
  distilledSummary: string;
  keyPoints: string[];
  practicalTakeaway: string;
  bluntRead: string;
}

export interface AIProvider {
  summarize(transcript: string, context: ProviderContext): Promise<SummaryResult>;
}

export interface ProviderContext {
  title: string;
  channel: string;
  description: string | null;
  duration: string;
}

/** Model id used for the active provider (for tags, logging, etc.). */
export function resolveSummarizerModel(config: Config): string {
  switch (config.provider) {
    case "openai":
      return config.openai?.model ?? "gpt-4o-mini";
    case "anthropic":
      return config.anthropic?.model ?? "claude-sonnet-4-5";
    case "ollama":
      return config.ollama?.model ?? "qwen3-coder:30b";
  }
}

export function createProvider(config: Config): AIProvider {
  switch (config.provider) {
    case "openai": {
      const apiKey =
        config.openai?.apiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OpenAI API key is required. Set "openai.apiKey" in ~/.yt-summary.json or OPENAI_API_KEY env var.'
        );
      }
      return new OpenAIProvider(apiKey, resolveSummarizerModel(config));
    }
    case "anthropic": {
      const apiKey =
        config.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          'Anthropic API key is required. Set "anthropic.apiKey" in ~/.yt-summary.json or ANTHROPIC_API_KEY env var.'
        );
      }
      return new AnthropicProvider(apiKey, resolveSummarizerModel(config));
    }
    case "ollama": {
      return new OllamaProvider(
        resolveSummarizerModel(config),
        config.ollama?.baseUrl ?? "http://127.0.0.1:11434/v1"
      );
    }
  }
}
