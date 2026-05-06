import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { VideoMetadata } from "./schemas.js";
import type { SummaryResult } from "./providers/index.js";
import { formatDuration } from "./extractor.js";

interface WriteOptions {
  vaultPath: string;
  targetFolder: string;
  includeTranscript: boolean;
  transcript: string | null;
  /** LLM model id used to generate the summary (added as `llm/...` tag). */
  summarizerModel: string;
}

export function writeNote(
  metadata: VideoMetadata,
  result: SummaryResult,
  options: WriteOptions
): string {
  const folderPath = join(options.vaultPath, options.targetFolder);
  mkdirSync(folderPath, { recursive: true });

  const filename = sanitizeFilename(metadata.title) + ".md";
  const filePath = join(folderPath, filename);

  const content = renderNote(metadata, result, options);
  writeFileSync(filePath, content, "utf-8");

  return filePath;
}

function renderNote(
  metadata: VideoMetadata,
  result: SummaryResult,
  options: WriteOptions
): string {
  const channel = metadata.channel ?? metadata.uploader ?? "Unknown";
  const dateStr = formatUploadDate(metadata.upload_date);
  const duration = metadata.duration ? formatDuration(metadata.duration) : "";
  const tags = buildTags(metadata, options.summarizerModel);

  const frontmatter = [
    "---",
    `title: "${escapeYaml(metadata.title)}"`,
    `channel: "${escapeYaml(channel)}"`,
    dateStr ? `date: ${dateStr}` : null,
    `url: ${metadata.webpage_url}`,
    duration ? `duration: "${duration}"` : null,
    metadata.view_count != null ? `views: ${metadata.view_count}` : null,
    `tags: [${tags.map((t) => `"${escapeYaml(t)}"`).join(", ")}]`,
    "---",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const sections: string[] = [
    frontmatter,
    "",
    `# ${metadata.title}`,
    "",
    `> **Channel:** ${channel}${dateStr ? `  |  **Published:** ${dateStr}` : ""}${duration ? `  |  **Duration:** ${duration}` : ""}`,
    `> **Watch:** ${metadata.webpage_url}`,
    "",
    "## Main Idea",
    "",
    result.mainIdea,
    "",
    "## Distilled Summary",
    "",
    result.distilledSummary,
  ];

  if (result.keyPoints.length > 0) {
    sections.push("", "## Key Points", "");
    for (const point of result.keyPoints) {
      sections.push(`- ${point}`);
    }
  }

  sections.push(
    "",
    "## Practical Takeaway",
    "",
    result.practicalTakeaway,
    "",
    "## My Blunt Read",
    "",
    result.bluntRead,
  );

  if (options.includeTranscript) {
    sections.push("", "## Transcript", "");
    if (options.transcript) {
      sections.push(options.transcript);
    } else {
      sections.push(
        "> No transcript available for this video. Subtitles were not found in any of the configured languages."
      );
    }
  }

  return sections.join("\n") + "\n";
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"');
}

function formatUploadDate(uploadDate?: string): string {
  if (!uploadDate || uploadDate.length !== 8) return "";
  // yt-dlp gives YYYYMMDD
  const y = uploadDate.slice(0, 4);
  const m = uploadDate.slice(4, 6);
  const d = uploadDate.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function slugifyModelForTag(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/[:/\\]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTags(metadata: VideoMetadata, summarizerModel: string): string[] {
  const tags = ["youtube", "summary"];
  const modelTag = `llm/${slugifyModelForTag(summarizerModel)}`;
  if (!tags.includes(modelTag)) tags.push(modelTag);
  if (metadata.categories) {
    for (const cat of metadata.categories.slice(0, 2)) {
      const slug = cat.toLowerCase().replace(/\s+/g, "-");
      if (!tags.includes(slug)) tags.push(slug);
    }
  }
  return tags;
}
