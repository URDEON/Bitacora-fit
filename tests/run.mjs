import { readdir, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
const files = (await readdir("tests")).filter((p) => p.endsWith(".test.ts"));
if (!files.length) throw new Error("No se encontraron pruebas críticas.");
await mkdir(".test-build", { recursive: true });
try {
  await build({
    entryPoints: files.map((p) => "tests/" + p),
    outdir: ".test-build",
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
  });
  const run = spawnSync(
    process.execPath,
    ["--test", ...files.map((p) => ".test-build/" + p.replace(/\.ts$/, ".js"))],
    { stdio: "inherit" },
  );
  process.exitCode = run.status ?? 1;
} finally {
  await rm(".test-build", { recursive: true, force: true });
}
