#!/usr/bin/env node
// Renders /leaflet/ to an exact-size PDF via headless Chrome's DevTools
// Protocol directly (not the `--print-to-pdf` CLI shortcut), because the
// shortcut always forces its own date/URL header and footer with no flag to
// disable it. Driving Page.printToPDF ourselves gives full control:
// preferCSSPageSize (so our @page B5 rule wins), printBackground, and
// displayHeaderFooter:false. This sidesteps Safari's print engine entirely,
// which was leaving a stray white rectangle at the bottom of printed pages.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFile } from "node:fs/promises";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE_PORT = 8756;
const CDP_PORT = 9331;
const PAGE_PATH = process.argv[3] || "/leaflet/";
const OUT = process.argv[2] || "leaflet.pdf";

async function waitForOk(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForJson(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const server = spawn(
  "python3",
  ["-m", "http.server", String(SITE_PORT), "--directory", "public"],
  { stdio: "ignore" }
);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" }
);

let ws;
try {
  await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
  await waitForOk(`http://127.0.0.1:${SITE_PORT}${PAGE_PATH}`);

  const tabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, {
    method: "PUT",
  });
  const tab = await tabRes.json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Page.enable");

  const loaded = new Promise((resolve) => {
    function onMsg(ev) {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Page.loadEventFired") {
        ws.removeEventListener("message", onMsg);
        resolve();
      }
    }
    ws.addEventListener("message", onMsg);
  });

  await send("Page.navigate", { url: `http://127.0.0.1:${SITE_PORT}${PAGE_PATH}` });
  await loaded;

  // Give deferred/CDN scripts (KaTeX auto-render) time to fetch and typeset.
  await sleep(2500);

  const result = await send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  });

  await writeFile(OUT, Buffer.from(result.data, "base64"));
  console.log(`Wrote ${OUT}`);
} finally {
  if (ws) ws.close();
  chrome.kill();
  server.kill();
}
