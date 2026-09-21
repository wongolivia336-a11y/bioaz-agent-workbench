// 用无头 Edge + CDP 把原型的几个关键状态截成 PNG，给对比讲稿用。
// 用法：先 npm run dev，再 node public/demo/compare/capture-ours.mjs
// 不装任何依赖：node 22+ 自带 WebSocket；Edge 是 Windows 自带的。
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3000/";
const OUT = path.resolve("public/demo/compare/img");
const PORT = 9333;
fs.mkdirSync(OUT, { recursive: true });

const profile = path.join(process.env.TEMP ?? ".", `bioaz-capture-${Date.now()}`);
const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,900", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForDevtools() {
  for (let i = 0; i < 50; i++) {
    try { const res = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (res.ok) return res.json(); } catch {}
    await sleep(200);
  }
  throw new Error("devtools not up");
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } }; }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
}

async function main() {
  await waitForDevtools();
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "evaluate failed");
    return result.value;
  };
  const shot = async (name) => {
    await sleep(400);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    console.log("saved", name);
  };
  const waitFor = (selector, timeout = 30000) => evaluate(`const t0 = Date.now(); while (!document.querySelector(${JSON.stringify(selector)})) { if (Date.now() - t0 > ${timeout}) throw new Error('timeout waiting ' + ${JSON.stringify(selector)}); await new Promise(r => setTimeout(r, 200)); } return true;`);
  const clickText = (selector, text) => evaluate(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.textContent.includes(${JSON.stringify(text)})); if (!el) throw new Error('no ' + ${JSON.stringify(text)}); el.click(); return true;`);
  const typeAndSend = (text) => evaluate(`const input = document.querySelector('input[placeholder]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(text)}); input.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); document.querySelector('button[aria-label="发送"]').click(); return true;`);
  const uploadProtocol = () => evaluate(`const input = document.querySelector('input.composerFileInput'); const dt = new DataTransfer(); dt.items.add(new File(["x"], "BB-001_食蟹猴28天DRF毒理试验方案_v2.0_20260915.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); document.querySelector('button[aria-label="发送"]').click(); return true;`);

  // 1. 全局首页
  await cdp.send("Page.navigate", { url: BASE });
  await waitFor(".taskExampleGrid button");
  await sleep(1200);
  await shot("ours-home");

  // 2. 空间首页
  await evaluate(`document.querySelector('button[title="进入空间"]').click(); return true;`);
  await waitFor(".newTaskIntro.isSpaceHome");
  await sleep(600);
  await shot("ours-space-home");

  // 3. 会话：一句话 → 板块出现（缺参数亮着）
  await evaluate(`[...document.querySelectorAll('.taskExampleGrid button')].find(b => b.textContent.includes('DMPK')).click(); return true;`);
  await waitFor('input[placeholder^="例如"]');
  await sleep(800);
  await typeAndSend("PK 小分子，SD 大鼠，每组 6 只，3 组，试验周期 2 周，血浆，中文报告");
  await waitFor(".dmpkQuoteSections");
  await sleep(1500);
  await shot("ours-session-sentence");

  // 4. 传方案 → 解析轨迹 + 参数收集（识别态）
  await uploadProtocol();
  await sleep(6000);
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === '参数收集')?.click(); return true;`);
  await sleep(600);
  await shot("ours-session-protocol");

  // 5. 板块面板（折叠态）
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === '报价板块').click(); return true;`);
  await sleep(500);
  await shot("ours-sections");

  // 6. 临时改价：展开动物使用，改食蟹猴使用费
  await evaluate(`[...document.querySelectorAll('.dmpkSectionHead')].find(h => h.querySelector('strong').textContent === '动物使用').click(); return true;`);
  await sleep(300);
  await evaluate(`const row = [...document.querySelectorAll('.dmpkSectionRow')].find(r => r.querySelector('.dmpkSectionRowName')?.textContent.startsWith('食蟹猴使用费')); row.querySelector('.dmpkPriceEdit').click(); await new Promise(r => setTimeout(r, 200)); const input = row.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '30000'); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await sleep(300);
  await shot("ours-temp-price-editor");
  await evaluate(`const row = [...document.querySelectorAll('.dmpkSectionRow')].find(r => r.querySelector('.dmpkSectionRowName')?.textContent.startsWith('食蟹猴使用费')); [...row.querySelectorAll('button')].find(b => b.textContent.trim() === '确认').click(); return true;`);
  await sleep(600);
  await shot("ours-temp-price-done");

  // 7. 对话里问本单价目
  await typeAndSend("列出本单命中的价目");
  await sleep(800);
  await evaluate(`document.querySelector('.dmpkCatalogHits')?.scrollIntoView({ block: 'start' }); return true;`);
  await sleep(400);
  await shot("ours-catalog-hits");

  // 8. 完整价目表（后台）
  await evaluate(`[...document.querySelectorAll('.dmpkSectionDoor')].find(d => d.textContent.includes('查看完整价目表')).click(); return true;`);
  await waitFor(".quotationManagementShell");
  await sleep(800);
  await shot("ours-catalog-backoffice");
  await clickText("button", "返回工作台");
  await sleep(600);

  // 9. + 菜单：技能
  await evaluate(`document.querySelector('.composerAddButton').click(); await new Promise(r => setTimeout(r, 300)); const row = [...document.querySelectorAll('.composerAttachRow button')].find(b => b.textContent.trim() === '技能'); row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); row.click(); return true;`);
  await sleep(500);
  await shot("ours-plus-skills");
  await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`);

  // 10. 站内信 + 复核画布（王林彬）
  await evaluate(`document.querySelector('button[aria-label^="收件箱"]').click(); return true;`);
  await sleep(800);
  await shot("ours-inbox");
  await evaluate(`[...document.querySelectorAll('button, a')].find(b => /Balb\\/c nude 报价交付包/.test(b.textContent)).click(); return true;`);
  await sleep(700);
  await clickText("button", "开始审核");
  await sleep(800);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '计算表')?.click(); return true;`);
  await sleep(600);
  await shot("ours-review-canvas");

  // 11. 数据中枢产物档
  await evaluate(`[...document.querySelectorAll('.sidebar button, aside button')].find(b => b.textContent.trim() === '数据中枢').click(); return true;`);
  await sleep(800);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '产物')?.click(); return true;`);
  await sleep(600);
  await shot("ours-hub-artifacts");

  ws.close();
  edge.kill();
  await sleep(300);
  fs.rmSync(profile, { recursive: true, force: true });
}

main().catch((error) => { console.error(error); edge.kill(); process.exit(1); });
