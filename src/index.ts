#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { fetchMetadata, fetchTranscript, type YtDlpOptions } from "./extractor.js";
import { createProvider, resolveSummarizerModel } from "./providers/index.js";
import { writeNote } from "./writer.js";
import type { Config } from "./schemas.js";

const program = new Command();

program
  .name("yt-summary")
  .description("Summarize a YouTube video and save it to your Obsidian vault")
  .version("0.1.0");

program
  .command("add <url>")
  .description("Fetch, summarize, and save a YouTube video")
  .option(
    "--provider <provider>",
    "Override LLM provider (openai | anthropic | ollama)"
  )
  .option("--no-transcript", "Skip including the transcript in the note")
  .action(async (url: string, options: { provider?: string; transcript: boolean }) => {
    try {
      const config = loadConfig();

      if (options.provider) {
        const allowed = ["openai", "anthropic", "ollama"];
        if (!allowed.includes(options.provider)) {
          console.error(
            `Invalid provider "${options.provider}". Must be one of: ${allowed.join(", ")}`
          );
          process.exit(1);
        }
        (config as Config).provider = options.provider as Config["provider"];
      }

      if (!options.transcript) {
        config.includeTranscript = false;
      }

      const ytDlpOptions: YtDlpOptions = {
        cookiesFromBrowser: config.cookiesFromBrowser,
        cookiesFile: config.cookiesFile,
        extraArgs: config.ytDlpExtraArgs,
      };

      console.log(`Fetching metadata for: ${url}`);
      const metadata = await fetchMetadata(url, ytDlpOptions);
      console.log(`  Title   : ${metadata.title}`);
      console.log(`  Channel : ${metadata.channel ?? metadata.uploader ?? "Unknown"}`);

      console.log("Fetching transcript...");
      const transcript = await fetchTranscript(url, config.languagePriority, ytDlpOptions);
      if (transcript) {
        console.log(`  Transcript fetched (${transcript.length} chars)`);
      } else {
        console.log("  No transcript available, summarizing from metadata only");
      }

      console.log(`Generating summary using ${config.provider}...`);
      const provider = createProvider(config);

      const channel = metadata.channel ?? metadata.uploader ?? "Unknown";
      const duration = metadata.duration
        ? `${Math.floor(metadata.duration / 60)}m ${Math.floor(metadata.duration % 60)}s`
        : "Unknown";

      const summaryResult = await provider.summarize(transcript ?? "", {
        title: metadata.title,
        channel,
        description: metadata.description,
        duration,
      });

      console.log("Writing note to Obsidian vault...");
      const filePath = writeNote(metadata, summaryResult, {
        vaultPath: config.vaultPath,
        targetFolder: config.targetFolder,
        includeTranscript: config.includeTranscript,
        transcript,
        summarizerModel: resolveSummarizerModel(config),
      });

      console.log(`\nDone! Note saved to:\n  ${filePath}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}`);
      if (err instanceof Error && err.cause) {
        console.error(`  Caused by: ${String(err.cause)}`);
      }
      process.exit(1);
    }
  });

program.parse();
