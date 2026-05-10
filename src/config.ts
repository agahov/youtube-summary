import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { ConfigSchema, type Config } from "./schemas.js";

const CONFIG_PATH = join(homedir(), ".yt-summary.json");

export function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    return filePath.replace("~", homedir());
  }
  return filePath;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found at ${CONFIG_PATH}.\n` +
        `Create it with at minimum:\n` +
        `{\n` +
        `  "vaultPath": "~/space/obsidian/raw/yt",\n` +
        `  "provider": "openai"\n` +
        `}`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to parse config at ${CONFIG_PATH}: ${String(err)}`);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config at ${CONFIG_PATH}:\n${issues}`);
  }

  const config = result.data;

  // Expand ~ in vaultPath
  config.vaultPath = expandTilde(config.vaultPath);

  // Fall back to env vars for API keys
  if (config.provider === "openai") {
    const existing = config.openai;
    config.openai = {
      model: existing?.model ?? "gpt-4o-mini",
      apiKey: existing?.apiKey ?? process.env.OPENAI_API_KEY,
    };
  }
  if (config.provider === "anthropic") {
    const existing = config.anthropic;
    config.anthropic = {
      model: existing?.model ?? "claude-sonnet-4-5",
      apiKey: existing?.apiKey ?? process.env.ANTHROPIC_API_KEY,
    };
  }

  return config;
}
