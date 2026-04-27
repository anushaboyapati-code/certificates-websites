#!/usr/bin/env node
/**
 * Move path/page.html -> path/page/index.html and fix relative asset paths
 * so S3/CloudFront can serve extensionless URLs (e.g. /academy/react-js, no .html).
 *
 * Skips: repository root index.html (home), and any folder index.html (already migrated).
 * Run from repo root: node scripts/migrate_pretty_urls.js
 */
const fs = require("fs");
const path = require("path");

const ROOT_NAMES = ["css", "js", "images"];

const repo = path.resolve(__dirname, "..");

function walkHtmlFiles(dir, out, { skipTopDot }) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".git") continue;
      if (name.name === ".github") continue;
      if (skipTopDot && name.name.startsWith(".") && dir === repo) continue;
      walkHtmlFiles(path.join(dir, name.name), out, { skipTopDot: false });
    } else if (name.isFile() && name.name.endsWith(".html")) {
      out.push(path.join(dir, name.name));
    }
  }
}

function adjustInOneLevelSubdir(content) {
  for (const n of ROOT_NAMES) {
    const old = `../${n}/`;
    const new_ = `../../${n}/`;
    content = content.split(old).join(new_);
  }
  return content;
}

function adjustMovedFromRoot(content) {
  for (const n of ROOT_NAMES) {
    content = content
      .split(`href="${n}/`)
      .join(`href="../${n}/`)
      .split(`src="${n}/`)
      .join(`src="../${n}/`)
      .split(`content="${n}/`)
      .join(`content="../${n}/`);
  }
  return content;
}

function toPosixRel(fromRepo, p) {
  return path.relative(fromRepo, p).split(path.sep).join("/");
}

function main() {
  const htmlFiles = [];
  walkHtmlFiles(repo, htmlFiles, { skipTopDot: true });

  htmlFiles.sort(
    (a, b) =>
      path.dirname(a).split(path.sep).length - path.dirname(b).split(path.sep).length || a.localeCompare(b)
  );

  for (const src of htmlFiles) {
    const rel = toPosixRel(repo, src);
    const base = path.basename(src);

    // Home page: index.html at repo root only
    if (base === "index.html" && path.dirname(src) === repo) {
      continue;
    }
    // Migrated pages live at slug/index.html; do not process again
    if (base === "index.html") {
      continue;
    }

    const relPath = path.relative(repo, src);
    const par = path.dirname(relPath);
    const pageName = path.basename(src, ".html");
    const destDir = path.join(repo, par, pageName);
    const dest = path.join(destDir, "index.html");

    if (fs.existsSync(dest) && path.resolve(dest) !== path.resolve(src)) {
      process.stderr.write(`Skip (target exists): ${toPosixRel(repo, dest)}\n`);
      continue;
    }

    let content = fs.readFileSync(src, { encoding: "utf8" });
    const parIsRoot = !par || par === ".";

    if (parIsRoot) {
      content = adjustMovedFromRoot(content);
    } else {
      content = adjustInOneLevelSubdir(content);
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(dest, content, { encoding: "utf8" });
    fs.unlinkSync(src);
    console.log(`${rel} -> ${toPosixRel(repo, dest)}`);
  }
}

main();
