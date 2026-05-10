import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execa } from "execa";
import { fetchMetadata, fetchTranscript, type YtDlpOptions } from "../../extractor.js";
import { writeNote } from "../../writer.js";
import { OllamaProvider } from "../../providers/ollama.js";
import type { SummaryResult } from "../../providers/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execa("yt-dlp", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

async function isOllamaAvailable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/version`);
    return res.ok;
  } catch {
    return false;
  }
}
//https://www.youtube.com/watch?v=0TPq43Wpbz0
const VIDEO_URL = "https://www.youtube.com/watch?v=RLX0S2PFams";
const VIDEO_ID = new URL(VIDEO_URL).searchParams.get("v") || "";
const OLLAMA_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL = "batiai/qwen3.6-27b:q4";
//const OLLAMA_MODEL = "qwen3-coder:30b";
const TEST_SUMMARIZER_MODEL = "gpt-4o-mini";

const YT_DLP_OPTS: YtDlpOptions = {
  cookiesFromBrowser: process.env.YT_COOKIES_BROWSER ?? "chrome",
};

const MOCK_SUMMARY: SummaryResult = {
  mainIdea: "This is the core idea of the video.",
  distilledSummary: "This is a test distilled summary of the video.",
  keyPoints: ["Key point one", "Key point two", "Key point three"],
  practicalTakeaway: "Here is what you should do after watching.",
  bluntRead: "Strongest idea is X, weakest part is Y.",
};

describe("yt-summary add — integration (PIy1PCA0FZ0)", () => {
  // All test output lands in <project>/tmp/YouTube/ for easy inspection
  const tmpDir = join(__dirname, "../../../tmp");
  const outputFolder = "YouTube";
  let ytDlpAvailable: boolean;
  let ollamaAvailable: boolean;

  beforeAll(async () => {
    mkdirSync(join(tmpDir, outputFolder), { recursive: true });
    console.log("\nTest output dir:", join(tmpDir, outputFolder));
    [ytDlpAvailable, ollamaAvailable] = await Promise.all([
      isYtDlpAvailable(),
      isOllamaAvailable(OLLAMA_URL),
    ]);
    if (!ytDlpAvailable) console.warn("yt-dlp not found — skipping network tests");
    if (!ollamaAvailable) console.warn(`Ollama not reachable at ${OLLAMA_URL} — skipping LLM test`);
  });

  // ── Case 1: metadata extraction ──────────────────────────────────────────

  describe("fetchMetadata", () => {
    it("returns a valid VideoMetadata object", async () => {
      if (!ytDlpAvailable) return;

      const metadata = await fetchMetadata(VIDEO_URL, YT_DLP_OPTS);

      expect(metadata.id).toBe(VIDEO_ID);
      expect(metadata.title).toBeTypeOf("string");
      expect(metadata.title.length).toBeGreaterThan(0);
      expect(metadata.webpage_url).toContain(VIDEO_ID);
      expect(metadata.duration).toBeTypeOf("number");
      expect((metadata.duration as number)).toBeGreaterThan(0);
    });
  });

  // ── Case 2: transcript extraction ────────────────────────────────────────

  describe("fetchTranscript", () => {
    it("returns a string or null — never throws", async () => {
      if (!ytDlpAvailable) return;

      const transcript = await fetchTranscript(VIDEO_URL, ["en", "ru"], YT_DLP_OPTS);

      const isValid =
        transcript === null ||
        (typeof transcript === "string" && transcript.length > 0);
      expect(isValid).toBe(true);
    });

    it("returns plain text without VTT markup when subtitles exist", async () => {
      if (!ytDlpAvailable) return;

      const transcript = await fetchTranscript(VIDEO_URL, ["en", "ru"], YT_DLP_OPTS);

      if (transcript !== null) {
        expect(transcript).not.toMatch(
          /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/
        );
        expect(transcript).not.toMatch(/<[a-z/][^>]*>/i);
      }
    });
  });

  // ── Case 3: full pipeline with real Ollama LLM ───────────────────────────

  describe("end-to-end with Ollama", () => {
    it(`generates a real summary via ${OLLAMA_MODEL} and writes the note`, async () => {
      if (!ytDlpAvailable || !ollamaAvailable) return;

      console.log(`  Fetching metadata...`);
      const metadata = await fetchMetadata(VIDEO_URL, YT_DLP_OPTS);

      console.log(`  Fetching transcript...`);
      const transcript = await fetchTranscript(VIDEO_URL, ["en", "ru"], YT_DLP_OPTS);
      console.log(
        transcript
          ? `  Transcript: ${transcript.length} chars`
          : "  No transcript found"
      );

      console.log(`  Calling ${OLLAMA_MODEL}...`);
      const provider = new OllamaProvider(OLLAMA_MODEL, OLLAMA_URL, 600_000);
      const result = await provider.summarize(transcript ?? "", {
        title: metadata.title,
        channel: metadata.channel ?? metadata.uploader ?? "Unknown",
        description: metadata.description,
        duration: metadata.duration
          ? `${Math.floor(metadata.duration / 60)}m ${Math.floor(metadata.duration % 60)}s`
          : "Unknown",
      });

      expect(result.mainIdea.length).toBeGreaterThan(10);
      expect(result.distilledSummary.length).toBeGreaterThan(50);
      expect(result.keyPoints.length).toBeGreaterThan(0);
      expect(result.practicalTakeaway.length).toBeGreaterThan(0);
      expect(result.bluntRead.length).toBeGreaterThan(0);

      const filePath = writeNote(metadata, result, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: true,
        transcript,
        summarizerModel: OLLAMA_MODEL,
      });
      console.log("  Written:", filePath);

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("## Main Idea");
      expect(content).toContain("## Distilled Summary");
      expect(content).toContain("## Key Points");
      expect(content).toContain("## Practical Takeaway");
      expect(content).toContain("## My Blunt Read");
    }, 600_000);
  });

  // ── Case 4: writeNote logic tests (no yt-dlp or LLM required) ────────────

  describe("writeNote (logic, no yt-dlp)", () => {
    const stubMetadata = {
      id: VIDEO_ID,
      title: "Test Video Title",
      description: "A test video description.",
      webpage_url: VIDEO_URL,
      channel: "Test Channel",
      upload_date: "20240115",
      duration: 754,
      tags: [],
      categories: ["Education"],
    };

    it("shows 'No transcript available' notice when transcript is null", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: true,
        transcript: null,
        summarizerModel: TEST_SUMMARIZER_MODEL,
      });
      console.log("  Written:", filePath);

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("## Transcript");
      expect(content).toContain("No transcript available");
    });

    it("renders transcript text when transcript is provided", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: true,
        transcript: "Hello and welcome to this video.",
        summarizerModel: TEST_SUMMARIZER_MODEL,
      });
      console.log("  Written:", filePath);

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("## Transcript");
      expect(content).toContain("Hello and welcome to this video.");
    });

    it("omits Transcript section when includeTranscript is false", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: false,
        transcript: null,
        summarizerModel: TEST_SUMMARIZER_MODEL,
      });
      console.log("  Written:", filePath);

      const content = readFileSync(filePath, "utf-8");
      expect(content).not.toContain("## Transcript");
    });

    it("includes categories as tags in frontmatter", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: false,
        transcript: null,
        summarizerModel: TEST_SUMMARIZER_MODEL,
      });

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("education");
    });

    it("includes summarizer model as llm/ tag in frontmatter", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: false,
        transcript: null,
        summarizerModel: "claude-sonnet-4-5",
      });

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain('"llm/claude-sonnet-4-5"');
    });

    it("slugifies model id for tag when name has colons", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: false,
        transcript: null,
        summarizerModel: "qwen3-coder:30b",
      });

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain('"llm/qwen3-coder-30b"');
    });

    it("formats upload_date as YYYY-MM-DD in frontmatter", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: false,
        transcript: null,
        summarizerModel: TEST_SUMMARIZER_MODEL,
      });

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("date: 2024-01-15");
    });

    it("formats duration correctly in header", () => {
      const filePath = writeNote(stubMetadata, MOCK_SUMMARY, {
        vaultPath: tmpDir,
        targetFolder: outputFolder,
        includeTranscript: false,
        transcript: null,
        summarizerModel: TEST_SUMMARIZER_MODEL,
      });

      const content = readFileSync(filePath, "utf-8");
      // 754 seconds = 12:34
      expect(content).toContain("12:34");
    });
  });
});
