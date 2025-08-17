#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const WARNING_MISSING_IN_SOURCES = "# NOTE: Key not found in .env or .env.local";

function printUsageAndExit(code) {
  const msg = [
    "Usage: copy-env-keys-to-env-example [--dry-run] [--output <path>]",
    "",
    "Options:",
    "  --dry-run            Print the resulting .env.example to stdout instead of writing",
    "  -o, --output <path>  Output file path (default: ./.env.example)",
  ].join("\n");
  console.error(msg);
  process.exit(code);
}

function parseCliArgs(argv, cwd) {
  let dryRun = false;
  let outputPath = path.join(cwd, ".env.example");
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        console.error(`Missing <path> after ${arg}`);
        printUsageAndExit(1);
      }
      outputPath = path.isAbsolute(next) ? next : path.join(cwd, next);
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }
    console.error(`Unknown argument: ${arg}`);
    printUsageAndExit(1);
  }
  return { dryRun, outputPath };
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) return null;
    throw err;
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
}

function isBlankLine(line) {
  return /^\s*$/.test(line);
}

function isCommentLine(line) {
  return /^\s*[#]/.test(line);
}

function stripExportPrefix(line) {
  return line.replace(/^\s*export\s+/, "");
}

function findUnquotedEqualsIndex(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "=" && !inSingle && !inDouble) return i;
  }
  return -1;
}

function parseAssignment(line) {
  // Returns { key, value, rawKey, rawValue } or null
  const withoutExport = stripExportPrefix(line);
  const idx = findUnquotedEqualsIndex(withoutExport);
  if (idx === -1) return null;
  const rawKey = withoutExport.slice(0, idx);
  const rawValue = withoutExport.slice(idx + 1);
  const key = rawKey.trim();
  return { key, value: rawValue, rawKey, rawValue };
}

function tokenizeEnvFile(content) {
  const lines = content.split(/\r?\n/);
  const tokens = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isBlankLine(line)) {
      tokens.push({ type: "blank", raw: line });
      continue;
    }
    if (isCommentLine(line)) {
      tokens.push({ type: "comment", raw: line });
      continue;
    }
    const assignment = parseAssignment(line);
    if (assignment && assignment.key) {
      tokens.push({ type: "assignment", raw: line, ...assignment });
    } else {
      // Unknown line; keep as comment to preserve content if ever needed
      tokens.push({ type: "comment", raw: line });
    }
  }
  return tokens;
}

function buildKeyIndexWithLeadingComments(tokens) {
  // Returns an ordered list of entries capturing leading comments for each first-time key.
  // entry: { key, commentsBefore: string[] }
  const seen = new Set();
  const entries = [];
  let pending = [];
  for (const token of tokens) {
    if (token.type === "comment" || token.type === "blank") {
      pending.push(token.raw);
      continue;
    }
    if (token.type === "assignment") {
      if (!seen.has(token.key)) {
        entries.push({ key: token.key, commentsBefore: pending.slice() });
        seen.add(token.key);
      }
      pending = [];
    }
  }
  // trailing comments without assignments are not attached to any key; preserve only when generating from scratch at the end
  return { entries, trailing: pending };
}

function uniqueKeyOrderFromTokens(primaryTokens, secondaryTokens) {
  const { entries: primaryEntries, trailing: primaryTrailing } = buildKeyIndexWithLeadingComments(primaryTokens);
  const seen = new Set(primaryEntries.map(e => e.key));
  const { entries: secondaryEntries, trailing: secondaryTrailing } = buildKeyIndexWithLeadingComments(secondaryTokens);
  const merged = primaryEntries.slice();
  for (const e of secondaryEntries) {
    if (!seen.has(e.key)) {
      merged.push(e);
      seen.add(e.key);
    }
  }
  return { orderedEntries: merged, trailingPrimary: primaryTrailing, trailingSecondary: secondaryTrailing };
}

function parseKeysFromContent(content) {
  const tokens = tokenizeEnvFile(content);
  const keys = [];
  for (const t of tokens) if (t.type === "assignment") keys.push(t.key);
  return new Set(keys);
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function buildExampleFromScratch(envContent, envLocalContent) {
  const envTokens = envContent ? tokenizeEnvFile(envContent) : [];
  const envLocalTokens = envLocalContent ? tokenizeEnvFile(envLocalContent) : [];
  const { orderedEntries, trailingPrimary, trailingSecondary } = uniqueKeyOrderFromTokens(envTokens, envLocalTokens);

  const lines = [];
  // If we have comments at top of .env, include them before the first key
  // Capture leading comments from the start of the first file, if present
  const leading = [];
  for (const t of envTokens) {
    if (t.type === "comment" || t.type === "blank") leading.push(t.raw);
    else break;
  }
  if (leading.length) lines.push(...leading);

  let firstEntryProcessed = false;
  for (const entry of orderedEntries) {
    if (entry.commentsBefore && entry.commentsBefore.length) {
      // Avoid duplicating the top header comments: if we've already emitted `leading`,
      // and this is the first entry, skip an identical prefix.
      if (!firstEntryProcessed && leading.length) {
        const a = leading;
        const b = entry.commentsBefore;
        if (a.length === b.length && a.every((v, i) => v === b[i])) {
          // skip
        } else {
          lines.push(...entry.commentsBefore);
        }
      } else {
        lines.push(...entry.commentsBefore);
      }
    }
    lines.push(`${entry.key}=`);
    firstEntryProcessed = true;
  }

  // Preserve trailing comments from primary, otherwise from secondary
  const trailing = (trailingPrimary && trailingPrimary.length) ? trailingPrimary : trailingSecondary;
  if (trailing && trailing.length) lines.push(...trailing);

  return lines.join("\n") + "\n";
}

function appendMissingKeysToExample(exampleContent, envContent, envLocalContent) {
  const exampleTokens = tokenizeEnvFile(exampleContent);
  const exampleKeys = new Set(exampleTokens.filter(t => t.type === "assignment").map(t => t.key));

  const envTokens = envContent ? tokenizeEnvFile(envContent) : [];
  const envLocalTokens = envLocalContent ? tokenizeEnvFile(envLocalContent) : [];
  const { orderedEntries } = uniqueKeyOrderFromTokens(envTokens, envLocalTokens);

  const missingEntries = orderedEntries.filter(e => !exampleKeys.has(e.key));
  if (missingEntries.length === 0) return exampleContent; // nothing to add

  const lines = exampleContent.replace(/\s*$/, "").split(/\r?\n/); // keep original, trim trailing whitespace-only lines
  lines.push("# --- Added by copy-env-keys-to-env-example on " + nowStamp() + " ---");
  for (const entry of missingEntries) {
    if (entry.commentsBefore && entry.commentsBefore.length) lines.push(...entry.commentsBefore);
    lines.push(`${entry.key}=`);
  }
  return lines.join("\n") + "\n";
}

function markUnknownKeysInExample(exampleContent, envContent, envLocalContent) {
  const envTokens = envContent ? tokenizeEnvFile(envContent) : [];
  const envLocalTokens = envLocalContent ? tokenizeEnvFile(envLocalContent) : [];
  const presentKeys = new Set();
  for (const t of envTokens) if (t.type === "assignment") presentKeys.add(t.key);
  for (const t of envLocalTokens) if (t.type === "assignment") presentKeys.add(t.key);

  const lines = exampleContent.split(/\r?\n/);
  const output = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const assignment = parseAssignment(line);
    if (assignment && assignment.key) {
      if (!presentKeys.has(assignment.key)) {
        // Insert the warning if the previous non-blank line isn't already the warning
        let j = output.length - 1;
        while (j >= 0 && /^\s*$/.test(output[j])) j -= 1;
        const prevIsWarning = j >= 0 && output[j] === WARNING_MISSING_IN_SOURCES;
        if (!prevIsWarning) output.push(WARNING_MISSING_IN_SOURCES);
      }
    }
    output.push(line);
  }
  // Ensure single trailing newline
  return output.join("\n").replace(/\n*$/, "\n");
}

function main() {
  const cwd = process.cwd();
  const { dryRun, outputPath } = parseCliArgs(process.argv.slice(2), cwd);
  const envPath = path.join(cwd, ".env");
  const envLocalPath = path.join(cwd, ".env.local");

  const envContent = readFileIfExists(envPath);
  const envLocalContent = readFileIfExists(envLocalPath);

  if (!envContent && !envLocalContent) {
    console.error("No .env or .env.local found. Nothing to do.");
    process.exit(1);
  }

  const exampleContent = readFileIfExists(outputPath);
  if (exampleContent == null) {
    const built = buildExampleFromScratch(envContent || "", envLocalContent || "");
    if (dryRun) {
      process.stdout.write(built);
      return;
    }
    writeFile(outputPath, built);
    console.log(`Created ${path.relative(cwd, outputPath)} with keys from .env and .env.local`);
    return;
  }

  const marked = markUnknownKeysInExample(exampleContent, envContent || "", envLocalContent || "");
  const updated = appendMissingKeysToExample(marked, envContent || "", envLocalContent || "");
  if (dryRun) {
    process.stdout.write(updated);
    return;
  }
  if (updated === exampleContent) {
    console.log("Output already contains all keys. Nothing to update.");
    return;
  }
  writeFile(outputPath, updated);
  console.log("Updated output file");
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

module.exports = {
  tokenizeEnvFile,
  buildExampleFromScratch,
  appendMissingKeysToExample,
  markUnknownKeysInExample,
};


