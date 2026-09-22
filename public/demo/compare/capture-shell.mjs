// 壳层那几张：三列怎么变形（右栏多 tab、+ 加面板、并列、全屏、收起）、同一副壳装别的业务线。
// 用法：npm run dev 起着，node public/demo/compare/capture-shell.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3000/";
const OUT = path.resolve("public/demo/compare/img");
const PORT = 9334;
const profile = path.join(process.env.TEMP ?? ".", `bioaz-capture-shell-${Date.now()}`);
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1440,900", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForDevtools() { for (let i = 0; i < 50; i++) { try { const res = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (res.ok) return res.json(); } catch {} await sleep(200); } throw new Error("devtools not up"); }
class Cdp { constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } }; } send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); } }

async function main() {
  await waitForDevtools();
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  const evaluate = async (expression) => { const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "evaluate failed"); return result.value; };
  const shot = async (name) => { await sleep(400); const { data } = await cdp.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64")); console.log("saved", name); };
  const waitFor = (selector, timeout = 30000) => evaluate(`const t0 = Date.now(); while (!document.querySelector(${JSON.stringify(selector)})) { if (Date.now() - t0 > ${timeout}) throw new Error('timeout ' + ${JSON.stringify(selector)}); await new Promise(r => setTimeout(r, 200)); } return true;`);
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click(); return true;`);
  const clickText = (selector, text) => evaluate(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.textContent.includes(${JSON.stringify(text)})); if (!el) throw new Error('no ' + ${JSON.stringify(text)}); el.click(); return true;`);
  const uploadProtocol = () => evaluate(`const input = document.querySelector('input.composerFileInput'); const dt = new DataTransfer(); dt.items.add(new File(["x"], "BB-001_食蟹猴28天DRF毒理试验方案_v2.0_20260915.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); document.querySelector('button[aria-label="发送"]').click(); return true;`);

  await cdp.send("Page.navigate", { url: BASE });
  await waitFor(".taskExampleGrid button"); await sleep(800);
  await click('button[title="进入空间"]'); await waitFor(".newTaskIntro.isSpaceHome"); await sleep(400);
  await evaluate(`[...document.querySelectorAll('.taskExampleGrid button')].find(b => b.textContent.includes('DMPK')).click(); return true;`);
  await waitFor('input[placeholder^="例如"]'); await sleep(600);
  await uploadProtocol(); await sleep(6500);

  // 1. 三列默认态 + 右栏 tab 栏
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === '报价板块').click(); return true;`); await sleep(500);
  await shot("ours-shell-3col");
  // 2. + 加面板：菜单开着
  await click('button[aria-label="添加面板"]'); await sleep(400);
  await shot("ours-shell-menu");
  await evaluate(`[...document.querySelectorAll('[role=menu] button, [role=menuitem]')].find(b => /输入材料/.test(b.textContent)).click(); return true;`); await sleep(300);
  await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`); await sleep(300);
  // 3. 并列：收起任务栏腾宽度，再把「参数收集」拉成一列
  await evaluate(`document.querySelector('button[aria-label="折叠侧边栏"]')?.click(); return true;`); await sleep(500);
  await evaluate(`const b = document.querySelector('button[aria-label="并列显示参数收集"]'); if (!b) throw new Error('no split button'); b.click(); return true;`); await sleep(700);
  await shot("ours-shell-columns");
  // 4. 全屏：面板铺满工作区
  await evaluate(`document.querySelector('button[aria-label="参数收集全屏"]')?.click(); return true;`); await sleep(700);
  await shot("ours-shell-focus");
  await evaluate(`document.querySelector('button[aria-label="退出全屏"]')?.click(); return true;`); await sleep(400);
  await evaluate(`document.querySelector('button[aria-label="把参数收集收回标签栏"]')?.click(); return true;`); await sleep(400);
  // 5. 收起右栏：两列
  await evaluate(`document.querySelector('button[aria-label="收起右侧面板"]')?.click(); return true;`); await sleep(600);
  await shot("ours-shell-2col");
  await evaluate(`document.querySelector('button[aria-label="展开右侧面板"]')?.click(); return true;`); await sleep(300);
  await evaluate(`document.querySelector('button[aria-label="展开侧边栏"]')?.click(); return true;`); await sleep(500);

  // 6. 同一副壳装别的业务线：QA 审核、肿瘤报价
  await evaluate(`[...document.querySelectorAll('aside button')].find(b => /王林彬/.test(b.textContent) && /SD/.test(b.textContent)).click(); return true;`); await sleep(400);
  await evaluate(`[...document.querySelectorAll('.accountLensRow button')].find(b => b.textContent.trim() === '总览').click(); return true;`); await sleep(800);
  await evaluate(`const q = [...document.querySelectorAll('button')].find(b => /样本 9 双批次/.test(b.textContent)); if (!q) throw new Error('no qa task: ' + [...document.querySelectorAll('aside button')].map(b => b.textContent.trim().slice(0, 12)).join('|')); q.click(); return true;`); await sleep(2500);
  await shot("ours-shell-qa");
  await evaluate(`[...document.querySelectorAll('button')].find(b => /Balb\\/c nude 报价/.test(b.textContent) && !/BA/.test(b.textContent)).click(); return true;`); await sleep(2500);
  await shot("ours-shell-tumor");

  ws.close(); edge.kill(); await sleep(300); fs.rmSync(profile, { recursive: true, force: true });
}
main().catch((error) => { console.error(error); edge.kill(); process.exit(1); });
