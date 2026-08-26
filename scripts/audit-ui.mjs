#!/usr/bin/env node
/**
 * UI 漂移体检。`npm run audit:ui`
 *
 * 为什么有这个脚本
 * ----------------------------------------------------------------------
 * docs/design-system.md 已经把规范写清楚了,末尾还老实写着一句:
 * 「这些规则用于代码评审和 Agent 决策,当前不阻断 typecheck、build 或 CI。」
 * 于是 159 行正确的规范,对着 9 处手写弹窗、42 处裸按钮类、11 个各不相同的
 * 空态、602 个重复选择器。缺的从来不是文档,是一个会报数的东西——
 * 散文会被跳过,数字不会。
 *
 * 它不阻断构建(阈值是 baseline 而不是 0,现状本来就超标)。它做的是:
 * 让"又变差了一点"这件事当场可见,而不是攒到某次走查才被发现。
 *
 * 用法
 *   npm run audit:ui              打印报告,跟 baseline 比
 *   npm run audit:ui -- --update  把当前数字写回 baseline(只在你确实改善了之后用)
 *   npm run audit:ui -- --full    连同明细一起打印
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "scripts", "audit-ui.baseline.json");
const argv = process.argv.slice(2);
const FULL = argv.includes("--full");
const UPDATE = argv.includes("--update");

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "public"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const files = walk(ROOT);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
const codeFiles = files.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes("scripts"));
const code = codeFiles.map((f) => ({ file: rel(f), text: fs.readFileSync(f, "utf8") }));
const allCode = code.map((c) => c.text).join("\n");

/* 只体检真正被加载的样式表。layout.tsx 就是那份清单——
   23 个文件全部平铺进同一个级联,谁覆盖谁只由 import 顺序决定,
   这也正是本项目每个"改了不生效"的 CSS bug 的根因。 */
const layout = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
const loadedRefs = [...layout.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((m) => m[1]);
const loaded = loadedRefs
  .map((r) => ({ ref: r, abs: path.resolve(ROOT, "app", r) }))
  .filter((f) => fs.existsSync(f.abs));

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/* 关键帧的 from/to/百分号不是选择器,别数进去。 */
const isKeyframeStop = (sel) => /^(from|to|\d+(\.\d+)?%)$/.test(sel);

// ── 1. 重复选择器 ────────────────────────────────────────────────────────
const occurrences = new Map();
for (const { ref, abs } of loaded) {
  const lines = stripComments(fs.readFileSync(abs, "utf8")).split("\n");
  let depth = 0;
  lines.forEach((line, i) => {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (opens > 0 && depth <= 1) {
      const head = line.slice(0, line.indexOf("{")).trim();
      if (head && !head.startsWith("@") && !head.startsWith(":root")) {
        for (const sel of head.split(",").map((s) => s.trim()).filter(Boolean)) {
          if (isKeyframeStop(sel)) continue;
          if (!occurrences.has(sel)) occurrences.set(sel, []);
          occurrences.get(sel).push(`${ref}:${i + 1}`);
        }
      }
    }
    depth = Math.max(0, depth + opens - closes);
  });
}
const dupes = [...occurrences].filter(([, v]) => v.length > 1);
const crossFile = dupes.filter(([, v]) => new Set(v.map((x) => x.split(":")[0])).size > 1);

// ── 2. 死类名 ────────────────────────────────────────────────────────────
/* 子串命中,不解析 className。宁可漏报不可误杀:
   Button/StatusChip 这类组件用模板字符串拼类名(`bioazUiButton--${variant}`),
   字面量在源码里根本不存在——直接删会删掉活代码。所以这个数字是"疑似",
   删之前必须逐个 grep 确认没有动态拼接。 */
const DYNAMIC_PREFIXES = ["bioazUi", "is-", "tone-"];
let deadTotal = 0;
let classTotal = 0;
const deadByFile = [];
for (const { ref, abs } of loaded) {
  const css = stripComments(fs.readFileSync(abs, "utf8"));
  const classes = new Set([...css.matchAll(/\.([A-Za-z][\w-]{2,})/g)].map((m) => m[1]));
  const dead = [...classes].filter(
    (c) => !allCode.includes(c) && !DYNAMIC_PREFIXES.some((p) => c.startsWith(p)),
  );
  classTotal += classes.size;
  deadTotal += dead.length;
  if (dead.length) deadByFile.push({ file: ref, dead: dead.length, of: classes.size, sample: dead.slice(0, 10) });
}
deadByFile.sort((a, b) => b.dead - a.dead);

// ── 3. 组件漂移 ──────────────────────────────────────────────────────────
const count = (re) => code.reduce((n, c) => n + (c.text.match(re) || []).length, 0);
const sites = (re) => code.filter((c) => re.test(c.text)).map((c) => c.file);

const handRolledModal = sites(/className="modalBackdrop"/).filter((f) => !f.endsWith("ui/Dialog.tsx"));
const drift = [
  {
    key: "modal",
    name: "弹窗",
    good: count(/<Dialog[\s>]/g),
    bad: handRolledModal.length,
    goodLabel: "<Dialog>",
    badLabel: '手写 className="modalBackdrop"',
    where: handRolledModal,
  },
  {
    key: "button",
    name: "按钮",
    good: sites(/<(Button|IconButton)[\s>]/).length,
    bad: count(/"(primaryButton|secondaryButton|iconButton)\b/g),
    goodLabel: "<Button>/<IconButton> 的文件数",
    badLabel: "裸 .primaryButton/.secondaryButton/.iconButton",
    where: sites(/"(primaryButton|secondaryButton|iconButton)\b/),
  },
  {
    key: "empty",
    name: "空态",
    good: count(/<EmptyState[\s>]/g),
    bad: new Set(
      code.flatMap((c) => [...c.text.matchAll(/className="([a-zA-Z]*[Ee]mpty[a-zA-Z]*)"/g)].map((m) => m[1]))
    ).size - 1, // 减掉 EmptyState 组件自己的 bioazUiEmptyIcon
    goodLabel: "<EmptyState>",
    badLabel: "各自造的空态类名种数",
    where: sites(/className="[a-zA-Z]*[Ee]mpty[a-zA-Z]*"/).filter((f) => !f.endsWith("ui/EmptyState.tsx")),
  },
];

// ── 报告 ─────────────────────────────────────────────────────────────────
const now = {
  stylesheets: loaded.length,
  selectors: occurrences.size,
  duplicateSelectors: dupes.length,
  crossFileDuplicates: crossFile.length,
  suspectDeadClasses: deadTotal,
  handRolledModals: drift[0].bad,
  rawButtonClasses: drift[1].bad,
  adHocEmptyStates: drift[2].bad,
};

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : null;
const delta = (k) => {
  if (!base || base[k] === undefined) return "";
  const d = now[k] - base[k];
  if (d === 0) return "   =";
  return d > 0 ? `  +${d} ✗` : `  ${d} ✓`;
};

console.log("\nUI 漂移体检");
console.log("=".repeat(64));
console.log(`全局加载的样式表        ${String(now.stylesheets).padStart(6)}${delta("stylesheets")}`);
console.log(`选择器(去重)            ${String(now.selectors).padStart(6)}${delta("selectors")}`);
console.log(`  其中被定义多次        ${String(now.duplicateSelectors).padStart(6)}${delta("duplicateSelectors")}`);
console.log(`  其中跨文件重复        ${String(now.crossFileDuplicates).padStart(6)}${delta("crossFileDuplicates")}   ← 谁生效取决于 layout.tsx 的 import 顺序`);
console.log(`疑似死类名              ${String(now.suspectDeadClasses).padStart(6)}${delta("suspectDeadClasses")}   ← 删前必须逐个确认没有动态拼接`);
console.log("-".repeat(64));
for (const d of drift) {
  const k = { modal: "handRolledModals", button: "rawButtonClasses", empty: "adHocEmptyStates" }[d.key];
  console.log(`${d.name.padEnd(6)} 用组件 ${String(d.good).padStart(3)} · 手写 ${String(d.bad).padStart(3)}${delta(k)}`);
  console.log(`       ${d.goodLabel}  vs  ${d.badLabel}`);
}
console.log("=".repeat(64));

if (FULL) {
  console.log("\n跨文件重复 TOP 15（同一个选择器写在多个文件里）");
  crossFile.sort((a, b) => b[1].length - a[1].length).slice(0, 15)
    .forEach(([sel, v]) => console.log(`  ${String(v.length).padStart(2)}x  ${sel}\n        ${v.join("  ")}`));
  console.log("\n疑似死类名，按文件");
  deadByFile.slice(0, 10).forEach((f) => console.log(`  ${f.file.padEnd(32)} ${f.dead}/${f.of}   ${f.sample.join(", ")}`));
  console.log("\n手写弹窗的位置（应迁到 <Dialog>，除非它的 header/footer 结构确实不同）");
  drift[0].where.forEach((f) => console.log(`  ${f}`));
}

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
  console.log(`\n已写回 baseline: ${rel(BASELINE)}`);
} else if (base) {
  const worse = Object.keys(now).filter((k) => base[k] !== undefined && now[k] > base[k]);
  if (worse.length) {
    console.log(`\n⚠  比 baseline 差了: ${worse.join(", ")}`);
    console.log("   要么改回去，要么确认这是有意的之后跑 npm run audit:ui -- --update");
  } else {
    console.log("\n没有比 baseline 更差。");
  }
} else {
  console.log("\n没有 baseline，跑一次 --update 建立基线。");
}
console.log("");
