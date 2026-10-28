// Scans git-tracked HTML files and writes manifest.json for index.html's TOC.
import { readFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDE = new Set(["index.html"]);

function extractTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  if (!match) return null;
  return match[1]
    .replace(/&bull;/g, "•")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTopic(html) {
  const match = html.match(/<meta\s+name=["']topic["']\s+content=["']([^"']*)["']\s*\/?>/i);
  return match ? match[1].trim() : "misc";
}

const tracked = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((rel) => !EXCLUDE.has(rel))
  .filter((rel) => !rel.startsWith("hidden/"));

const pages = [];

for (const rel of tracked) {
  const full = path.join(ROOT, rel);
  const html = await readFile(full, "utf8");
  const title = extractTitle(html) || rel;
  const topic = extractTopic(html);
  const { mtime } = await stat(full);
  pages.push({ path: rel, title, topic, modified: mtime.toISOString() });
}

pages.sort((a, b) => a.path.localeCompare(b.path));

const manifest = { generated: new Date().toISOString(), pages };

await writeFile(
  path.join(ROOT, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

// Also emit as a plain <script> global so index.html works when opened directly
// via file:// (fetch() of local JSON is blocked by browsers under file://).
await writeFile(
  path.join(ROOT, "manifest.js"),
  `window.__MANIFEST__ = ${JSON.stringify(manifest, null, 2)};\n`
);

console.log(`Wrote manifest.json and manifest.js with ${pages.length} page(s).`);
