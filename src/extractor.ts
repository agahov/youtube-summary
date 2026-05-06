import { execa } from "execa";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { VideoMetadataSchema, type VideoMetadata } from "./schemas.js";
import { expandTilde } from "./config.js";

export interface YtDlpOptions {
  cookiesFromBrowser?: string;
  cookiesFile?: string;
  extraArgs?: string[];
}

function buildAuthArgs(options?: YtDlpOptions): string[] {
  const args: string[] = [];
  if (!options) return args;
  if (options.cookiesFromBrowser) {
    args.push("--cookies-from-browser", options.cookiesFromBrowser);
  } else if (options.cookiesFile) {
    args.push("--cookies", expandTilde(options.cookiesFile));
  }
  if (options.extraArgs) {
    args.push(...options.extraArgs);
  }
  return args;
}

export async function fetchMetadata(
  url: string,
  options?: YtDlpOptions
): Promise<VideoMetadata> {
  let result: Awaited<ReturnType<typeof execa>>;
  try {
    result = await execa("yt-dlp", [
      ...buildAuthArgs(options),
      "--dump-json",
      "--no-playlist",
      url,
    ]);
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "stderr" in err
          ? String((err as { stderr: unknown }).stderr)
          : String(err);
    throw new Error(`yt-dlp metadata fetch failed: ${msg}`);
  }

  const stdout =
    typeof result.stdout === "string"
      ? result.stdout
      : Buffer.isBuffer(result.stdout)
        ? result.stdout.toString("utf-8")
        : String(result.stdout ?? "");

  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch {
    throw new Error("yt-dlp returned invalid JSON for metadata");
  }

  const parsed = VideoMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Unexpected metadata structure from yt-dlp:\n${issues}`);
  }

  return parsed.data;
}

export async function fetchTranscript(
  url: string,
  languagePriority: string[],
  options?: YtDlpOptions
): Promise<string | null> {
  const tmpDir = join(tmpdir(), `yt-summary-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    return await tryFetchSubtitles(url, languagePriority, tmpDir, options);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function tryFetchSubtitles(
  url: string,
  languagePriority: string[],
  outDir: string,
  options?: YtDlpOptions
): Promise<string | null> {
  const langList = languagePriority.join(",");

  // Try manual subtitles first, then auto-generated
  for (const autoFlag of [false, true]) {
    const args = [
      ...buildAuthArgs(options),
      "--skip-download",
      "--no-playlist",
      autoFlag ? "--write-auto-sub" : "--write-sub",
      "--sub-lang",
      langList,
      "--sub-format",
      "vtt/srt/best",
      "--convert-subs",
      "vtt",
      "-o",
      join(outDir, "%(id)s.%(ext)s"),
      url,
    ];

    try {
      await execa("yt-dlp", args);
    } catch {
      // yt-dlp exits non-zero when no subs found; continue
    }

    const transcript = readSubtitleFile(outDir, languagePriority);
    if (transcript) return transcript;
  }

  return null;
}

function readSubtitleFile(
  dir: string,
  languagePriority: string[]
): string | null {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return null;
  }

  // Prefer languages in priority order
  for (const lang of languagePriority) {
    const match = files.find(
      (f) => f.includes(`.${lang}.vtt`) || f.includes(`.${lang}.srt`)
    );
    if (match) {
      const raw = readFileSync(join(dir, match), "utf-8");
      return parseVtt(raw);
    }
  }

  // Fallback: any .vtt file
  const anyVtt = files.find((f) => f.endsWith(".vtt"));
  if (anyVtt) {
    return parseVtt(readFileSync(join(dir, anyVtt), "utf-8"));
  }

  return null;
}

function parseVtt(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let prevLine = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip header, timestamps, cue identifiers, and empty lines
    if (
      trimmed === "WEBVTT" ||
      trimmed === "" ||
      /^\d{2}:\d{2}/.test(trimmed) || // timestamp line
      /^[\d]+$/.test(trimmed) // sequence number
    ) {
      continue;
    }

    // Strip VTT tags like <00:00:01.000>, <c>, </c>
    const clean = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (clean && clean !== prevLine) {
      textLines.push(clean);
      prevLine = clean;
    }
  }

  return textLines.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
