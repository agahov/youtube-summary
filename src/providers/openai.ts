import OpenAI from "openai";
import type { AIProvider, ProviderContext, SummaryResult } from "./index.js";
import { buildPrompt, parseStructuredResponse } from "../summarizer.js";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async summarize(
    transcript: string,
    context: ProviderContext
  ): Promise<SummaryResult> {
    const prompt = buildPrompt(transcript, context);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseStructuredResponse(text);
  }
}
