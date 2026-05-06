import { Ollama } from "ollama";
import type { AIProvider, ProviderContext, SummaryResult } from "./index.js";
import { buildPrompt, parseStructuredResponse } from "../summarizer.js";

export class OllamaProvider implements AIProvider {
  private client: Ollama;

  constructor(
    private readonly model: string,
    baseUrl: string
  ) {
    this.client = new Ollama({ host: baseUrl });
  }

  async summarize(
    transcript: string,
    context: ProviderContext
  ): Promise<SummaryResult> {
    const prompt = buildPrompt(transcript, context);

    const response = await this.client.chat({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: 0.3 },
    });

    const text = response.message.content;
    return parseStructuredResponse(text);
  }
}
