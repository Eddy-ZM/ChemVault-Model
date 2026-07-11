import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";

const values = process.argv.slice(2);
const args = new Map();
for (let index = 0; index < values.length; index += 2) {
  const key = values[index];
  const value = values[index + 1];
  if (!key?.startsWith("--") || !value || value.startsWith("--")) {
    throw new Error(`Invalid argument near ${key || "end of command"}.`);
  }
  const name = key.slice(2);
  args.set(name, [...(args.get(name) || []), value]);
}

for (const key of ["file", "app", "platform", "version", "base-url", "output"]) {
  if (!args.has(key)) throw new Error(`Missing --${key}.`);
}
const value = (key) => args.get(key)[0];
const files = args.get("file");
const baseUrl = value("base-url").replace(/\/+$/u, "");
if (!/^https:\/\//u.test(baseUrl)) throw new Error("Release URL must use HTTPS.");
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(value("version"))) throw new Error("Version must use semantic versioning.");

const publishedAt = new Date().toISOString();
const assets = await Promise.all(files.map(async (filePath) => {
  const bytes = await readFile(filePath);
  const file = await stat(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = basename(filePath);
  await writeFile(`${filePath}.sha256`, `${sha256}  ${fileName}\n`);
  return {
    app: value("app"),
    platform: value("platform"),
    type: /portable/iu.test(fileName) ? "portable" : /setup/iu.test(fileName) ? "installer" : "binary",
    version: value("version"),
    url: `${baseUrl}/${encodeURIComponent(fileName)}`,
    sha256,
    size: file.size,
    publishedAt,
    fileName
  };
}));
const manifest = { schemaVersion: 1, generatedAt: publishedAt, assets };
await writeFile(value("output"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${value("output")} and SHA-256 files for ${assets.length} release assets.`);
