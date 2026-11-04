import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Short commit id for the build stamp on the title screen. */
function buildSha(): string {
  const fromCi = process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // GitHub Pages serves the game from https://robin-bird-bot.github.io/HITWO/.
  // Used in dev too, so a missing base path shows up locally.
  base: '/HITWO/',
  plugins: [react()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __BUILD_SHA__: JSON.stringify(buildSha()),
  },
  build: {
    // Keep dist/assets/ for Wyatt's art and fonts (copied from public/assets/);
    // Vite's hashed JS and CSS go to dist/bundle/.
    assetsDir: 'bundle',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
