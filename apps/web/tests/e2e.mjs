import { chromium } from "playwright";

const WEB = "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const videoState = (page) =>
  page.evaluate(() => {
    const v = document.querySelector("video");
    if (!v) return null;
    return {
      present: true,
      paused: v.paused,
      time: v.currentTime,
      src: v.currentSrc || v.src,
      readyState: v.readyState,
      error: v.error ? v.error.message : null,
    };
  });

async function waitFor(cond, timeoutMs, label) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await cond();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`   [debug] ${label} last value:`, JSON.stringify(last));
  throw new Error(`timeout waiting for ${label}`);
}

const browser = await chromium.launch();

try {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const hostErrors = [];
  host.on("pageerror", (e) => hostErrors.push(String(e)));
  host.on("console", (m) => {
    if (m.type() === "error") hostErrors.push(m.text());
  });
  host.on("websocket", (ws) => {
    ws.on("framereceived", (f) => {
      try {
        const ev = JSON.parse(f.payload);
        console.log(`   [ws<-] ${ev.type}`, JSON.stringify(ev).slice(0, 140));
      } catch {}
    });
    ws.on("framesent", (f) => {
      try {
        const ev = JSON.parse(f.payload);
        console.log(`   [ws->] ${ev.type}`, JSON.stringify(ev).slice(0, 140));
      } catch {}
    });
  });

  await host.goto(`${WEB}/create`);
  await host.fill("#username", "Bata");
  await host.click("button[type=submit]");
  await host.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });
  const url = new URL(host.url());
  const code = url.pathname.split("/").pop();
  check("host created + entered room", /^[A-Z0-9]{6}$/.test(code), code);

  await waitFor(
    async () =>
      host.getByText("Connected", { exact: false }).isVisible().catch(() => false),
    10000,
    "status pill Connected",
  );
  check("host WS connected pill visible", true);

  await host.getByRole("button", { name: /open test stream/i }).click();
  const hv = await waitFor(() => videoState(host).then((s) => (s?.present && s.readyState >= 1 ? s : null)), 30000, "host video element");
  check("test stream opened after click", hv.present, hv.src.slice(-30));

  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await guest.goto(`${WEB}/join`);
  await guest.fill("#code", code);
  await guest.getByRole("button", { name: /join room/i }).click();
  await guest.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });
  await waitFor(() => videoState(guest).then((s) => (s?.present && s.readyState >= 1 ? s : null)), 30000, "guest auto-followed media");
  check("guest automatically sees same video", true);

  await host.evaluate(() => {
    const v = document.querySelector("video");
    if (v) v.muted = true;
  });
  await host.locator("footer button[aria-label=Play]").click();
  const hp = await waitFor(
    () => videoState(host).then((s) => (!s?.paused ? s : null)),
    15000,
    "host playing",
  );
  check("host plays via control bar", true, `t=${hp.time.toFixed(1)}s`);

  const gp = await waitFor(
    () => videoState(guest).then((s) => (!s?.paused && s.readyState >= 2 ? s : null)),
    20000,
    "guest playing",
  );
  check("guest autoplay follows host", true, `t=${gp.time.toFixed(1)}s`);

  await host.waitForTimeout(2500);
  const h2 = await videoState(host);
  const g2 = await videoState(guest);
  const drift = Math.abs(h2.time - g2.time);
  check("playback synchronized drift < 1.5s", drift < 1.5, `${drift.toFixed(2)}s`);

  await host.locator("footer button[aria-label=Pause]").click();
  await waitFor(() => videoState(host).then((s) => (s?.paused ? s : null)), 10000, "host paused");
  await waitFor(() => videoState(guest).then((s) => (s?.paused ? s : null)), 15000, "guest paused");
  check("pause propagates to guest", true);

  await host.evaluate(() => {
    const btn = document.querySelector('input[type=range][aria-label=Seek]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(btn, "6");
    btn.dispatchEvent(new Event("input", { bubbles: true }));
    btn.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitFor(
    () => videoState(guest).then((s) => (Math.abs(s.time - 6) < 2 ? s : null)),
    15000,
    "guest seeked to ~6s",
  );
  check("seek propagates to guest (~6s)", true);

  const chatText = `halo-${Date.now()}`;
  await guest.fill('aside input[placeholder="Message…"]', chatText);
  await guest.keyboard.press("Enter");
  await waitFor(
    () => host.getByText(chatText).isVisible().catch(() => false),
    10000,
    "chat delivered",
  );
  check("guest→host chat delivered", true);

  const relevantErrors = hostErrors.filter(
    (e) => !e.includes("favicon") && !e.includes("net::ERR") && !e.includes("Autoplay"),
  );
  check("no page errors on host", relevantErrors.length === 0, relevantErrors.slice(0, 2).join(" | "));

  await hostCtx.close();
  await guestCtx.close();
} catch (err) {
  check(`E2E aborted: ${String(err).split("\n").slice(0, 12).join(" | ").slice(0, 900)}`, false);
  try {
    await host.screenshot({ path: "tests/fail-host.png" });
    const stage = await host.evaluate(() =>
      document.querySelector("main")?.innerText.slice(0, 400),
    );
    console.log(`   [debug] main innerText:`, JSON.stringify(stage));
  } catch {}
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} E2E checks passed`);
process.exit(failed > 0 ? 1 : 0);
