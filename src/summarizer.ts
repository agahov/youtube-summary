import type { ProviderContext, SummaryResult } from "./providers/index.js";

const MAX_TRANSCRIPT_CHARS = 80_000;

export function buildPrompt(
  transcript: string,
  context: ProviderContext
): string {
  const truncated =
    transcript.length > MAX_TRANSCRIPT_CHARS
      ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) +
        "\n\n[transcript truncated for length]"
      : transcript;

  return `You summarize YouTube videos in a practical, skeptical style.

Video information:
- Title: ${context.title}
- Channel: ${context.channel}
- Duration: ${context.duration}
${context.description ? `- Description: ${context.description.slice(0, 500)}` : ""}

Read the subtitles below and summarize them.

${transcript ? `Subtitles:\n"""\n${truncated}\n"""` : "No transcript available. Summarize based on title and description only."}

Provide your response in the following exact format (keep the section headers exactly as shown):

MAIN_IDEA:
Explain the real core idea in 2-4 sentences. Make clear if the headline topic is not the real point.

DISTILLED_SUMMARY:
Summarize the argument in clear paragraphs. Group related ideas. Remove filler, repetition, sponsor sections, and weak examples.

KEY_POINTS:
- [Give 4-7 specific bullets]

PRACTICAL_TAKEAWAY:
Explain what the viewer should do, decide, or watch out for.

BLUNT_READ:
Give a direct judgment: strongest idea, weak/overhyped part, and what matters most.

Rules:
- Be concise but not shallow.
- Do not invent facts.
- Say when something is unclear.
- Keep technical terms when they matter.
- Use clear English and short paragraphs.
- Do not include any text outside of the five sections above.`;
}

const SECTION_MARKERS = [
  "MAIN_IDEA",
  "DISTILLED_SUMMARY",
  "KEY_POINTS",
  "PRACTICAL_TAKEAWAY",
  "BLUNT_READ",
] as const;

function extractSection(text: string, marker: string): string {
  const pattern = new RegExp(
    `${marker}:\\s*([\\s\\S]*?)(?=${SECTION_MARKERS.filter((m) => m !== marker)
      .map((m) => `${m}:`)
      .join("|")}|$)`,
    "i"
  );
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function extractBullets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter((l) => l.length > 0);
}

export function parseStructuredResponse(text: string): SummaryResult {
  return {
    mainIdea: extractSection(text, "MAIN_IDEA"),
    distilledSummary: extractSection(text, "DISTILLED_SUMMARY"),
    keyPoints: extractBullets(extractSection(text, "KEY_POINTS")),
    practicalTakeaway: extractSection(text, "PRACTICAL_TAKEAWAY"),
    bluntRead: extractSection(text, "BLUNT_READ"),
  };
}
