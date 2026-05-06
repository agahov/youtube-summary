import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ProviderContext, SummaryResult } from "./index.js";
import { buildPrompt, parseStructuredResponse } from "../summarizer.js";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async summarize(
    transcript: string,
    context: ProviderContext
  ): Promise<SummaryResult> {
    const prompt = buildPrompt(transcript, context);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    return parseStructuredResponse(text);
  }
}
