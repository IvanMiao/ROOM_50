import { cp, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const publicFiles = [
  "AGENT.md",
  "AGENTS.md",
  "llms.txt",
  "manifest.webmanifest",
  "robots.txt",
] as const;

const publicDirectories = [".well-known", "agent", "assets", "ginse"] as const;

function copyAgentResources(): Plugin {
  let outputDirectory = resolve("dist");

  return {
    name: "copy-agent-resources",
    apply: "build",
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await mkdir(outputDirectory, { recursive: true });

      await Promise.all([
        ...publicFiles.map((file) =>
          copyFile(resolve(file), resolve(outputDirectory, file)),
        ),
        ...publicDirectories.map((directory) =>
          cp(resolve(directory), resolve(outputDirectory, directory), {
            recursive: true,
          }),
        ),
      ]);
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [copyAgentResources()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
