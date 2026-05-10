import { Ollama } from "ollama";
import { Agent, fetch as undiciFetch } from "undici";
import type { AIProvider, ProviderContext, SummaryResult } from "./index.js";
import { buildPrompt, parseStructuredResponse } from "../summarizer.js";

export class OllamaProvider implements AIProvider {
  constructor(
    private readonly model: string,
    private readonly baseUrl: string,
    private readonly requestTimeout: number,
  ) {}

  async summarize(
    transcript: string,
    context: ProviderContext
  ): Promise<SummaryResult> {
    const prompt = buildPrompt(transcript, context);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    // Use a custom undici Agent so headersTimeout and bodyTimeout are both
    // governed by requestTimeout rather than undici's 300s default.
    const agent = new Agent({
      headersTimeout: this.requestTimeout,
      bodyTimeout: this.requestTimeout,
      connectTimeout: 30_000,
    });

    // Use undici's own fetch (same version as the Agent) so the dispatcher
    // option is accepted without a version mismatch against Node's built-in
    // undici copy.
    const client = new Ollama({
      host: this.baseUrl,
      fetch: ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) =>
        undiciFetch(input, {
          ...init,
          signal: controller.signal,
          dispatcher: agent,
        })) as unknown as typeof globalThis.fetch,
    });

    try {
      const response = await client.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        options: { temperature: 0.3 },
      });

      return parseStructuredResponse(response.message.content);
    } finally {
      clearTimeout(timer);
      void agent.destroy();
    }
  }
}
