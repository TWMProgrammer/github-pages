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

const tracked = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((rel) => !EXCLUDE.has(rel));

const pages = [];

for (const rel of tracked) {
  const full = path.join(ROOT, rel);
  const html = await readFile(full, "utf8");
  const title = extractTitle(html) || rel;
  const { mtime } = await stat(full);
  pages.push({ path: rel, title, modified: mtime.toISOString() });
}

pages.sort((a, b) => a.path.localeCompare(b.path));

await writeFile(
  path.join(ROOT, "manifest.json"),
  JSON.stringify({ generated: new Date().toISOString(), pages }, null, 2) + "\n"
);

console.log(`Wrote manifest.json with ${pages.length} page(s).`);
