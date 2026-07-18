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

const publicDirectories = [
  ".well-known",
  "agent",
  "assets",
  "demo/fixtures",
  "docs",
] as const;

function copyAgentResources(): Plugin {
  let projectRoot = resolve(".");
  let outputDirectory = resolve("dist");

  return {
    name: "copy-agent-resources",
    apply: "build",
    configResolved(config) {
      projectRoot = config.root;
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await mkdir(outputDirectory, { recursive: true });

      await Promise.all([
        ...publicFiles.map((file) =>
          copyFile(resolve(projectRoot, file), resolve(outputDirectory, file)),
        ),
        ...publicDirectories.map((directory) =>
          cp(resolve(projectRoot, directory), resolve(outputDirectory, directory), {
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
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        demo: resolve("demo/index.html"),
      },
    },
  },
});
