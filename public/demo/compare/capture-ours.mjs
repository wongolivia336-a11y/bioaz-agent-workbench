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

  // 3b. 积木：右栏「参数收集」的台账（基础 ①②③ / PK-TK ④–⑧ / 交付）下面再搭一块 TOX，
  //     台账多一张 TOX 卡、板块面板多一段；composer 参数卡展开看分页联动。拍完拆掉。
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === '参数收集').click(); return true;`);
  await sleep(400);
  await evaluate(`const h = [...document.querySelectorAll('.inspectorParameterGroupHeader')].find(b => b.textContent.trim().startsWith('检测')); if (h && h.getAttribute('aria-expanded') !== 'true') h.click(); return true;`);
  await sleep(400);
  await evaluate(`[...document.querySelectorAll('.dmpkPackageAdd button')].find(b => b.textContent.trim() === 'TOX').click(); return true;`);
  await sleep(900);
  await evaluate(`const head = document.querySelector('.parameterTaskCard .warningDecisionHeader'); if (head && head.getAttribute('aria-expanded') !== 'true') head.click(); return true;`);
  await sleep(400);
  await evaluate(`document.querySelector('.dmpkPackageCards')?.scrollIntoView({ block: 'end' }); return true;`);
  await sleep(300);
  await shot("ours-blocks");
  await evaluate(`document.querySelector('.dmpkPackageCardRemove')?.click(); return true;`);
  await sleep(600);
  await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`);
  await sleep(300);

  // 4. 传方案 → 解析轨迹 + 参数收集（识别态）
  await uploadProtocol();
  await sleep(6000);
  // 讲稿里引用的那句「已读取…」：数字随账变，打出来好核对讲稿的文案
  console.log("reply:", await evaluate(`return [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /已读取/.test(e.textContent)).map(e => e.textContent.trim()).at(-1) ?? '';`));
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === '参数收集')?.click(); return true;`);
  await sleep(600);
  await shot("ours-session-protocol");

  // 4b. 输入材料：读出来的事实按八维排
  await evaluate(`document.querySelector('button[aria-label="添加面板"]').click(); await new Promise(r => setTimeout(r, 250)); [...document.querySelectorAll('[role=menu] button, [role=menuitem]')].find(b => /输入材料/.test(b.textContent)).click(); return true;`);
  await sleep(300);
  // 勾完面板菜单不自己收，点一下外面
  await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`);
  await sleep(300);
  await evaluate(`document.querySelector('.dmpkFactList')?.scrollIntoView({ block: 'start' }); return true;`);
  await sleep(300);
  await shot("ours-materials-dims");

  // 5. 板块面板（折叠态）
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === '报价板块').click(); return true;`);
  await sleep(500);
  await shot("ours-sections");

  // 6. 临时改价：展开 PK / TK 样品采集，改 TK 毒代采血的单价
  const sectionRow = (name) => `[...document.querySelectorAll('.dmpkSectionRow')].find(r => r.querySelector('.dmpkSectionRowName')?.textContent.startsWith(${JSON.stringify(name)}))`;
  const typeInto = (rowExpr, value) => `const row = ${rowExpr}; const input = row.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`;
  const confirmRow = (rowExpr) => `const row = ${rowExpr}; [...row.querySelectorAll('button')].find(b => b.textContent.trim() === '确认').click(); return true;`;
  // 板块默认哪些是展开的随账变，所以按 aria-expanded 开合，不盲点
  const setSection = (name, open) => evaluate(`const h = [...document.querySelectorAll('.dmpkSectionHead')].find(h => h.querySelector('strong').textContent === ${JSON.stringify(name)}); if ((h.getAttribute('aria-expanded') === 'true') !== ${open}) h.click(); return true;`);
  await setSection("实验", true);
  await sleep(300);
  await evaluate(`${sectionRow("TK 毒代采血")}.querySelector('.dmpkPriceEdit').click(); return true;`);
  await sleep(200);
  await evaluate(typeInto(sectionRow("TK 毒代采血"), "120"));
  await sleep(300);
  await shot("ours-temp-price-editor");
  await evaluate(confirmRow(sectionRow("TK 毒代采血")));
  await sleep(500);
  // 6b. 补价：猴类价是人工输入项，账上标「待补价」，同一条路补上；再记一个本单折扣
  await setSection("实验", false);
  await setSection("动物", true);
  await sleep(300);
  // 行右端那枚 ¥ 圆钮（原来是「补价」两个字）
  await evaluate(`${sectionRow("食蟹猴使用费")}.querySelector('.dmpkRowFix').click(); return true;`);
  await sleep(200);
  await evaluate(typeInto(sectionRow("食蟹猴使用费"), "30000"));
  await evaluate(confirmRow(sectionRow("食蟹猴使用费")));
  await sleep(400);
  await evaluate(`document.querySelector('button[aria-label="改本单折扣"]').click(); await new Promise(r => setTimeout(r, 200)); const input = document.querySelector('input[aria-label="本单折扣"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '0.9'); input.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 100)); [...document.querySelectorAll('.dmpkSectionAdjust button')].find(b => b.textContent.trim() === '确认').click(); return true;`);
  await sleep(600);
  await evaluate(`document.querySelector('.dmpkSectionFooter')?.scrollIntoView({ block: 'end' }); return true;`);
  await sleep(300);
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

  // 10. 补齐参数 → 生成 → 交接给李林
  await typeAndSend("每组 2 只，LC-MS/MS，国内报价");
  await sleep(3500);
  await clickText("button", "确认并生成报价单");
  await sleep(6500);
  await evaluate(`const card = document.querySelector('.dmpkHandoffCard'); [...card.querySelectorAll('button')].find(b => b.textContent.trim() === '选择接手的同事').click(); await new Promise(r => setTimeout(r, 400)); [...document.querySelectorAll('[role=menu] button, [role=menuitem], [role=option], [role=listbox] button')].find(b => /李林/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 300)); const note = card.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(note, '请复核 BB-001：猴价按本单补的 3 万，整单 9 折'); note.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); [...card.querySelectorAll('button')].find(b => b.textContent.trim() === '交接').click(); return true;`);
  await sleep(900);

  // 10b. 切到李林（先把演示范围切到「总览」，DMPK 镜头里只有赵敏 / 王林彬两个账号）
  const openAccountMenu = () => evaluate(`if (!document.querySelector('.accountMenu')) [...document.querySelectorAll('aside button')].find(b => /王林彬|李林/.test(b.textContent) && /SD/.test(b.textContent)).click(); return true;`);
  await openAccountMenu();
  await sleep(400);
  await evaluate(`[...document.querySelectorAll('.accountLensRow button')].find(b => b.textContent.trim() === '总览').click(); return true;`);
  await sleep(500);
  await openAccountMenu();
  await sleep(400);
  await evaluate(`[...document.querySelectorAll('.accountSwitchRow')].find(b => /李林/.test(b.textContent)).click(); return true;`);
  await sleep(1000);

  // 10c. 站内信：刚交过来的那张单在最上面 → 开始审核 → 依据与变更 / 计算表
  await evaluate(`document.querySelector('button[aria-label^="收件箱"]').click(); return true;`);
  await sleep(800);
  await shot("ours-inbox");
  await evaluate(`[...document.querySelectorAll('button, a')].find(b => /请复核：DMPK 报价任务/.test(b.textContent)).click(); return true;`);
  await sleep(700);
  await clickText("button", "开始审核");
  await sleep(900);
  await evaluate(`[...document.querySelectorAll('.quoteFormSwitch button')].find(b => b.textContent.trim() === '依据与变更')?.click(); return true;`);
  await sleep(600);
  await shot("ours-review-evidence");
  await evaluate(`[...document.querySelectorAll('.quoteFormSwitch button')].find(b => b.textContent.trim() === '计算表')?.click(); return true;`);
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
