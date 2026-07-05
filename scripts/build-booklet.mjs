#!/usr/bin/env node
// Imposes an existing B5 leaflet PDF (from print-leaflet.mjs) onto A4 sheets
// in booklet order, so printing duplex on A4 and folding down the middle
// produces a proper 8-page A5 booklet:
//   Sheet 1 front: 8 | 1     Sheet 1 back: 2 | 7
//   Sheet 2 front: 6 | 3     Sheet 2 back: 4 | 5
// Uses pdfbook2 (part of TeX Live / MacTeX) to do the actual scaling and
// signature imposition — it already produces exactly this canonical
// saddle-stitch order for a single 8-page signature, so no manual page
// reordering is needed on top.
import { spawnSync } from "node:child_process";
import { mkdtempSync, copyFileSync, renameSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

const SRC = process.argv[2] || "leaflet.pdf";
const OUT = process.argv[3] || "leaflet-booklet.pdf";

if (!existsSync(SRC)) {
  console.error(`Input not found: ${SRC}`);
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), "booklet-"));
const inputCopy = join(workDir, "input.pdf");
copyFileSync(SRC, inputCopy);

const result = spawnSync(
  "pdfbook2",
  ["--paper=a4paper", "--no-crop", inputCopy],
  { cwd: workDir, stdio: "inherit" }
);

if (result.status !== 0) {
  rmSync(workDir, { recursive: true, force: true });
  console.error("pdfbook2 failed — is it installed? (part of TeX Live / MacTeX)");
  process.exit(result.status ?? 1);
}

const produced = join(workDir, "input-book.pdf");
renameSync(produced, OUT);
rmSync(workDir, { recursive: true, force: true });
console.log(`Wrote ${OUT}`);
