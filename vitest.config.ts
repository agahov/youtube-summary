import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // yt-dlp network calls can take a while
    testTimeout: 60_000,
    hookTimeout: 15_000,
    reporters: ["verbose"],
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
