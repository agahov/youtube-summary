# yt-summary

A Node.js CLI that fetches a YouTube video's metadata and transcript, summarizes it with an LLM, and saves the result as a Markdown note in your Obsidian vault.

## Prerequisites

- Node.js >= 20
- pnpm
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) installed and on `$PATH`

```bash
brew install yt-dlp   # macOS
```

## Setup

### 1. Install and build

```bash
pnpm install
pnpm build
pnpm link --global
```

### 2. Create config file

Create `~/.yt-summary.json`:

```json
{
  "vaultPath": "~/space/obsidian",
  "targetFolder": "row/YouTube",
  "languagePriority": ["en", "ru"],
  "includeTranscript": true,
  "provider": "openai",
  "openai": {
    "apiKey": "sk-...",
    "model": "gpt-4o-mini"
  }
}
```

Or use Anthropic / Ollama as the provider:

```json
{
  "vaultPath": "~/space/obsidian",
  "targetFolder": "row/YouTube",
  "languagePriority": ["en", "ru"],
  "includeTranscript": true,
  "provider": "anthropic",
  "anthropic": {
    "apiKey": "sk-ant-...",
    "model": "claude-sonnet-4-5"
  }
}
```

```json
{
  "vaultPath": "~/space/obsidian",
  "targetFolder": "row/YouTube",
  "languagePriority": ["en"],
  "includeTranscript": false,
  "provider": "ollama",
  "ollama": {
    "model": "llama3",
    "baseUrl": "http://localhost:11434"
  }
}
```

API keys can also be provided via environment variables as a fallback:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```bash
# Summarize a video
yt-summary add "https://www.youtube.com/watch?v=VIDEO_ID"

# Override provider for a single run
yt-summary add "https://www.youtube.com/watch?v=VIDEO_ID" --provider anthropic

# Skip transcript in the note
yt-summary add "https://www.youtube.com/watch?v=VIDEO_ID" --no-transcript
```

## Config reference

| Field               | Type       | Default       | Description                                    |
|---------------------|------------|---------------|------------------------------------------------|
| `vaultPath`         | `string`   | required      | Absolute or `~/`-prefixed path to vault root   |
| `targetFolder`      | `string`   | `"YouTube"`   | Subfolder within the vault                     |
| `languagePriority`  | `string[]` | `["en"]`      | Language codes tried in order for subtitles    |
| `includeTranscript` | `boolean`  | `true`        | Append raw transcript to the note              |
| `provider`          | `string`   | `"openai"`    | `openai` \| `anthropic` \| `ollama`            |
| `openai.apiKey`     | `string`   | –             | OpenAI API key                                 |
| `openai.model`      | `string`   | `gpt-4o-mini` | OpenAI model name                              |
| `anthropic.apiKey`  | `string`   | –             | Anthropic API key                              |
| `anthropic.model`   | `string`   | `claude-sonnet-4-5` | Anthropic model name                    |
| `ollama.model`      | `string`   | `llama3`      | Ollama model name                              |
| `ollama.baseUrl`    | `string`   | `http://localhost:11434` | Ollama server URL               |

## Output

Each video produces a Markdown file at `{vaultPath}/{targetFolder}/{video-title}.md`:

```markdown
---
title: "Video Title"
channel: "Channel Name"
date: 2024-01-15
url: https://www.youtube.com/watch?v=...
duration: "12:34"
tags: [youtube, summary]
---

# Video Title

> **Channel:** Channel Name  |  **Published:** 2024-01-15  |  **Duration:** 12:34
> **Watch:** https://www.youtube.com/watch?v=...

## Summary

...

## Key Points

- ...

## Transcript

...
```
