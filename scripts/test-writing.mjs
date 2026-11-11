// Browser tests for writing practice, run in Chromium with touch input.
// Run from the project folder: node scripts/test-writing.mjs
// (Starts its own local server on port 8123; needs Playwright installed.)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8123;
const BASE = `http://localhost:${PORT}`;

let server;
let browser;

before(async () => {
  server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  // Wait until the server answers.
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

// A fresh tablet-size touch page.
async function newPage(url, viewport = { width: 1024, height: 768 }) {
  const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (err) => console.error("page error:", err.message));
  await page.goto(BASE + url);
  return page;
}

// Real touch drag through the given page coordinates (Chrome DevTools touch events).
async function touchDrag(page, points) {
  const cdp = await page.context().newCDPSession(page);
  const tp = ([x, y]) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(points[0]) });
  for (const p of points.slice(1)) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(p) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

// Points along a straight line, inclusive.
const line = ([x1, y1], [x2, y2], n = 12) =>
  Array.from({ length: n }, (_, i) => [x1 + ((x2 - x1) * i) / (n - 1), y1 + ((y2 - y1) * i) / (n - 1)]);

// Page position of a point given in 109-unit box coordinates on a canvas.
async function boxToPage(page, selector, [x, y]) {
  const r = await page.locator(selector).boundingBox();
  return [r.x + (x / 109) * r.width, r.y + (y / 109) * r.height];
}

async function padPage() {
  const page = await newPage("/scripts/pad-fixture.html");
  await page.waitForFunction(() => window.padReady);
  return page;
}

// ======================================================================
// Writing pad (js/writing-pad.js)
// ======================================================================

test("drag draws one stroke", async () => {
  const page = await padPage();
  const a = await boxToPage(page, "#pad", [20, 50]);
  const b = await boxToPage(page, "#pad", [90, 50]);
  await touchDrag(page, line(a, b));
  const strokes = await page.evaluate(() => pad.strokes);
  assert.equal(strokes.length, 1);
  for (const [x, y] of strokes[0]) {
    assert.ok(x >= 0 && x <= 109 && y >= 0 && y <= 109, `point ${x},${y} outside box`);
  }
  assert.ok(Math.abs(strokes[0][0][0] - 20) < 2 && Math.abs(strokes[0].at(-1)[0] - 90) < 2);
  await page.context().close();
});

test("tap is ignored", async () => {
  const page = await padPage();
  const a = await boxToPage(page, "#pad", [50, 50]);
  await touchDrag(page, [a, a]);
  assert.equal(await page.evaluate(() => pad.strokes.length), 0);
  await page.context().close();
});

test("second finger ignored", async () => {
  const page = await padPage();
  const n = await page.evaluate(() => {
    const c = document.getElementById("pad");
    const r = c.getBoundingClientRect();
    const at = (bx, by) => ({ clientX: r.left + (bx / 109) * r.width, clientY: r.top + (by / 109) * r.height });
    const fire = (type, id, bx, by) =>
      c.dispatchEvent(
        new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, bubbles: true, ...at(bx, by) })
      );
    fire("pointerdown", 1, 20, 20);
    fire("pointermove", 1, 40, 20);
    fire("pointerdown", 2, 80, 90); // palm / second finger
    fire("pointermove", 2, 90, 100);
    fire("pointermove", 1, 60, 20);
    fire("pointerup", 2, 90, 100);
    fire("pointermove", 1, 80, 20);
    fire("pointerup", 1, 80, 20);
    return pad.strokes;
  });
  assert.equal(n.length, 1);
  for (const [, y] of n[0]) assert.ok(Math.abs(y - 20) < 1, "second finger's points leaked in");
  assert.ok(Math.abs(n[0].at(-1)[0] - 80) < 1);
  await page.context().close();
});

test("cancel ends stroke", async () => {
  const page = await padPage();
  const strokes = await page.evaluate(() => {
    const c = document.getElementById("pad");
    const r = c.getBoundingClientRect();
    const fire = (type, bx, by) =>
      c.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true,
          clientX: r.left + (bx / 109) * r.width, clientY: r.top + (by / 109) * r.height,
        })
      );
    fire("pointerdown", 20, 30);
    fire("pointermove", 50, 30);
    fire("pointercancel", 50, 30);
    fire("pointerdown", 20, 70);
    fire("pointermove", 60, 70);
    fire("pointerup", 60, 70);
    return pad.strokes;
  });
  assert.equal(strokes.length, 2, "cancelled stroke kept and a new stroke started");
  assert.ok(Math.abs(strokes[1][0][1] - 70) < 1);
  await page.context().close();
});

test("resize keeps strokes", async () => {
  const page = await padPage();
  await touchDrag(page, line(await boxToPage(page, "#pad", [20, 54]), await boxToPage(page, "#pad", [90, 54])));
  const before = await page.evaluate(() => JSON.stringify(pad.strokes));
  await page.evaluate(() => (document.getElementById("pad").style.width = "300px"));
  await page.waitForTimeout(200); // ResizeObserver + redraw
  const after = await page.evaluate(() => JSON.stringify(pad.strokes));
  assert.equal(after, before);
  // Ink should sit on the stroke's new position: middle of the box at y = 54/109.
  const inked = await page.evaluate(() => {
    const c = document.getElementById("pad");
    const ctx = c.getContext("2d");
    const y = Math.round((54 / 109) * c.height);
    const x = Math.round((70 / 109) * c.width);
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    return { a, dark: r + g + b < 300 };
  });
  assert.ok(inked.a > 0 && inked.dark, "no ink at the scaled stroke position");
  await page.context().close();
});

test("undo and clear", async () => {
  const page = await padPage();
  for (const y of [30, 60, 90]) {
    await touchDrag(page, line(await boxToPage(page, "#pad", [20, y]), await boxToPage(page, "#pad", [90, y])));
  }
  assert.equal(await page.evaluate(() => pad.strokes.length), 3);
  await page.evaluate(() => pad.undo());
  assert.equal(await page.evaluate(() => pad.strokes.length), 2);
  await page.evaluate(() => pad.clear());
  assert.equal(await page.evaluate(() => pad.strokes.length), 0);
  await page.context().close();
});

test("samplePaths", async () => {
  const page = await padPage();
  const [pts] = await page.evaluate(() => samplePaths(["M10,10L60,10"]));
  assert.ok(Math.abs(pts[0][0] - 10) < 0.5 && Math.abs(pts[0][1] - 10) < 0.5);
  assert.ok(Math.abs(pts.at(-1)[0] - 60) < 0.5 && Math.abs(pts.at(-1)[1] - 10) < 0.5);
  await page.context().close();
});

// ======================================================================
// Writing section in the app (index.html)
// ======================================================================

// Open the app at `hash`, with writing settings `filters` saved beforehand.
async function appPage(hash, filters = null, viewport) {
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1024, height: 768 }, hasTouch: true, serviceWorkers: "block",
  });
  if (filters) {
    await context.addInitScript((f) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("kana:writing-filters", JSON.stringify(f));
        sessionStorage.setItem("seeded", "1");
      }
    }, filters);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (err) => console.error("page error:", err.message));
  await page.goto(`${BASE}/index.html${hash}`);
  await page.waitForSelector("#landing-screen:not([hidden]), #home-screen:not([hidden]), #writing-screen:not([hidden]), #study-screen:not([hidden])");
  return page;
}

const ONLY_N = { scripts: ["hiragana"], stages: [1], rows: ["n"], order: "chart", reviewOnly: false };

// Write a character correctly in box `index` by replaying its reference strokes.
async function writeChar(page, ch, index = 0) {
  const refs = await page.evaluate(async (c) => {
    const { samplePaths } = await import("/js/writing-pad.js");
    const strokes = await (await fetch("/data/strokes.json")).json();
    return samplePaths(strokes[c]);
  }, ch);
  const r = await page.locator(".w-box").nth(index).boundingBox();
  for (const stroke of refs) {
    const pts = stroke.filter((_, i) => i % 3 === 0 || i === stroke.length - 1);
    await touchDrag(page, pts.map(([x, y]) => [r.x + (x / 109) * r.width, r.y + (y / 109) * r.height]));
  }
}

test("practice shows model and box", async () => {
  const page = await appPage("#writing/practice");
  assert.equal(await page.locator("#w-model .w-model-svg path").count(), 3); // あ
  assert.equal(await page.locator(".w-box").count(), 1);
  assert.equal(await page.locator("#w-model").isVisible(), true);
  assert.match(await page.locator("#counter").textContent(), /1 \/ 46/);
  await page.context().close();
});

test("check correct strokes passes", async () => {
  const page = await appPage("#writing/practice");
  await writeChar(page, "あ");
  await page.click("#w-check");
  assert.match(await page.locator("#w-message").textContent(), /Nice!/);
  const seen = await page.evaluate(() => localStorage.getItem("kana:seen") || "");
  assert.ok(seen.includes("wr:h-a"));
  await page.context().close();
});

test("check with nothing written", async () => {
  const page = await appPage("#writing/practice");
  await page.click("#w-check");
  assert.equal(await page.locator("#w-message").textContent(), "Write the character first.");
  const seen = await page.evaluate(() => localStorage.getItem("kana:seen") || "");
  assert.ok(!seen.includes("wr:h-a"));
  await page.context().close();
});

test("combination has two boxes", async () => {
  const page = await appPage("#writing/practice/h-kya", { scripts: ["hiragana"], stages: [3], rows: [], order: "chart", reviewOnly: false });
  assert.equal(await page.locator(".w-box").count(), 2);
  assert.equal(await page.locator("#w-model .w-model-svg").count(), 2);
  await page.context().close();
});

test("quiz hides model until check", async () => {
  const page = await appPage("#writing/quiz", ONLY_N);
  assert.equal(await page.locator("#w-model").isVisible(), false);
  assert.equal(await page.locator("#w-prompt").isVisible(), true);
  assert.match(await page.locator("#w-prompt").textContent(), /n · Hiragana/);
  assert.equal(await page.locator("#w-rate").isVisible(), false);
  await writeChar(page, "ん");
  await page.click("#w-check");
  assert.equal(await page.locator("#w-model").isVisible(), true);
  await page.click("#w-got");
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem("kana:progress") || "{}"));
  assert.equal(progress["wr:h-n"], 1);
  await page.context().close();
});

test("landing has writing tile", async () => {
  const page = await appPage("");
  assert.equal(await page.locator(".tile").count(), 4);
  assert.equal(await page.locator(".tile strong").last().textContent(), "Writing");
  await page.context().close();
});

test("writing home", async () => {
  const page = await appPage("#writing");
  assert.equal((await page.locator("#start").textContent()).trim(), "Start practice");
  assert.equal(await page.locator("#start-quiz").isVisible(), true);
  assert.equal(await page.locator("#writing-chart button").count(), 46);
  await page.context().close();
});

test("chart opens practice", async () => {
  const page = await appPage("#writing");
  await page.locator("#writing-chart button", { hasText: "か" }).first().click();
  await page.waitForFunction(() => location.hash === "#writing/practice/h-ka");
  assert.equal(await page.locator("#w-model .w-model-svg").getAttribute("aria-label"), "か");
  await page.context().close();
});

test("extended katakana stage", async () => {
  const page = await appPage("#writing");
  await page.click("#open-settings");
  const stage4 = page.locator('label:has(input[name="stage"][value="4"])');
  assert.equal(await stage4.isVisible(), false, "stage 4 hidden while katakana is off");
  await page.locator('input[name="script"][value="katakana"]').check();
  assert.equal(await stage4.isVisible(), true);
  await page.locator('input[name="stage"][value="4"]').check();
  await page.click(".done-btn");
  await page.locator("#writing-chart button", { hasText: "ティ" }).waitFor(); // chart re-renders on close
  assert.equal(await page.locator("#writing-chart button", { hasText: "ティ" }).count(), 1);
  assert.equal(await page.locator("#writing-chart button").count(), 112); // 46 + 46 + 20
  await page.context().close();
});

test("no matches disables buttons", async () => {
  const page = await appPage("#writing", { scripts: ["hiragana"], stages: [1], rows: [], order: "chart", reviewOnly: true });
  assert.equal(await page.locator("#start").isDisabled(), true);
  assert.equal(await page.locator("#start-quiz").isDisabled(), true);
  assert.match(await page.locator("#deck-summary").textContent(), /No cards/);
  await page.context().close();
});

test("progress survives reload", async () => {
  const page = await appPage("#writing/quiz", ONLY_N);
  await writeChar(page, "ん");
  await page.click("#w-check");
  await page.click("#w-got");
  await page.goto(`${BASE}/index.html#writing`);
  await page.reload();
  const cls = await page.locator("#writing-chart button", { hasText: "ん" }).getAttribute("class");
  assert.match(cls, /learning/);
  await page.context().close();
});

test("phone width", async () => {
  const page = await appPage("#writing/practice", null, { width: 360, height: 740 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= 360, `page is ${width}px wide`);
  await page.context().close();
});

test("flash cards unaffected", async () => {
  const page = await appPage("#kana/study");
  await page.click("#flip");
  assert.equal(await page.locator("#rating").getAttribute("inert"), null);
  await page.context().close();
});

// ======================================================================
// Offline (sw.js)
// ======================================================================

test("works offline", async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${BASE}/index.html#writing`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready; // installed: every app file is cached
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
  // Only the service worker's own cache may help: empty the browser's HTTP cache.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  await context.setOffline(true);
  await page.evaluate(() => (location.hash = "#writing/practice"));
  await page.reload(); // a real page load, served by the service worker
  await page.waitForSelector("#writing-screen:not([hidden])");
  assert.equal(await page.locator("#w-model .w-model-svg path").count(), 3);
  assert.equal(await page.locator(".w-box").count(), 1);
  await context.close();
});
