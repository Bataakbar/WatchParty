import { chromium } from "playwright";

const WEB = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("websocket", (ws) => {
  ws.on("framereceived", (f) => {
    const t = String(f.payload).match(/"type":"([A-Z_]+)"/);
    if (t && !["SYNC_STATE", "PONG"].includes(t[1])) console.log(`[ws<-] ${t[1]}`);
  });
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto(`${WEB}/create`);
await page.fill("#username", "Probe");
await page.click("button[type=submit]");
await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
const code = new URL(page.url()).pathname.split("/").pop();
console.log("room:", code);

await page.waitForTimeout(1500);
await page.getByRole("button", { name: /open test stream/i }).click();
await page.waitForTimeout(3000);

const state = await page.evaluate(() => {
  const v = document.querySelector("video");
  return {
    hasVideo: !!v,
    readyState: v?.readyState ?? null,
    err: v?.error ? `${v.error.code} ${v.error.message}` : null,
    mainText: document.querySelector("main")?.innerText.slice(0, 200),
  };
});
console.log(JSON.stringify(state, null, 2));

const btnInfo = await page.evaluate(() => {
  const b = document.querySelector('footer button[aria-label]');
  return b
    ? { label: b.getAttribute("aria-label"), disabled: b.disabled, cls: b.className.slice(0, 80) }
    : null;
});
console.log("play-button:", JSON.stringify(btnInfo));

await browser.close();
