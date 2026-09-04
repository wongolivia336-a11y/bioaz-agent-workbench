/**
 * 令牌收敛的验收脚本。
 *
 * 为什么需要它
 * ----------------------------------------------------------------------
 * 把裸值换成令牌是几百处机械替换，而 CSS 改错了**不会报错**——它只是渲染成
 * 别的样子。截图证明不了 1px 或一个色阶的差异（见 SKILL 第三节），
 * 逐个肉眼看几百处也不现实。
 *
 * 所以改成「量」：把改动前后每一条声明**解析 var() 到最终值**再逐条比对。
 * 别名替换（`8px → var(--bioaz-radius-tool)`、`#fff → var(--bioaz-surface)`）
 * 解析后完全相同，应当报 **0 处变化**；吸附（`9px → 8px`）会报出来，
 * 条数必须跟预期对得上。
 *
 * 用法：
 *   node scripts/token-diff.mjs                        圆角，跟 HEAD 比
 *   node scripts/token-diff.mjs --prop background      换个属性
 *   node scripts/token-diff.mjs --prop 'background|color|border-color'
 *   node scripts/token-diff.mjs <git-ref>              跟指定提交比
 *
 * 退出码永远是 0——这个脚本给的是**账**，不是判决。哪些该变、变几处，
 * 由改的人在提交信息里说清楚。
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const propIndex = args.indexOf("--prop");
/* 属性名参与正则，所以不能直接插进去——`border-radius` 里的连字符无所谓，
   但使用方给的是一串用 | 分隔的属性，得整个包起来再要求后面紧跟冒号。 */
const propPattern = propIndex >= 0 ? args[propIndex + 1] : "border-radius";
const ref = args.filter((a, i) => a !== "--prop" && i !== propIndex + 1)[0] ?? "HEAD";

const files = fs.readdirSync("app").filter((f) => f.endsWith(".css")).map((f) => "app/" + f)
  .concat(["styles/design-system.css"]);

/* 令牌表取自当前的 tokens.css。旧版里那几套并存令牌它不认识，
   所以单独列出来——它们的值是在浏览器里 getComputedStyle 读出来的，
   不是从 CSS 文件里读的（文件里读到的多半是被覆盖那层，见 SKILL 第三节）。 */
const tokens = new Map();
for (const m of fs.readFileSync("styles/tokens.css", "utf8").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  tokens.set(m[1], m[2].trim());
}
const legacy = {
  "--radius-control": "12px", "--radius-card": "16px", "--radius-md": "12px",
  "--radius-lg": "16px", "--radius-sm": "8px",
  "--review-radius-sm": "8px", "--review-radius-md": "12px", "--review-radius-lg": "18px",
  /* 这三个从来没被定义过。var() 解不开又没有兜底值时，属性回落到初始值 0——
     而且不报错。第五轮就是这么翻出三个「一直是直角」的 bug 的。 */
  "--bioaz-radius-pill": "(未定义→0)", "--bioaz-radius-modal": "(未定义→0)", "--bioaz-radius-sm": "(未定义→0)",
};

function resolve(value, depth = 0) {
  if (depth > 6 || !value.includes("var(")) return value;
  const next = value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g, (whole, name, fallback) =>
    tokens.get(name) ?? legacy[name] ?? (fallback ? fallback.trim() : "(未定义→0)"));
  return next === value ? value : resolve(next, depth + 1);
}

/* `#fff` 和 `#ffffff` 是同一个颜色。不归一的话，把 `#fff` 换成
   `var(--bioaz-surface)`（值是 `#ffffff`）会被报成一处变化——
   那是假的，会把真正的差异淹掉。 */
const normalizeHex = (value) =>
  value.replace(/#([0-9a-f]{3})\b/g, (_, h) => "#" + h.split("").map((c) => c + c).join(""));

const declarations = (css) =>
  [...css.matchAll(new RegExp(`(?:^|[;{\\s])(?:${propPattern}):\\s*([^;}]+)[;}]`, "g"))]
    .map((m) => normalizeHex(resolve(m[1].trim().toLowerCase())).replace(/\s+/g, " "));

let unchanged = 0;
const changes = new Map();
const structural = [];

for (const file of files) {
  let before;
  try {
    before = execSync(`git show ${ref}:${file}`, { maxBuffer: 1e8 }).toString();
  } catch {
    structural.push(`${file}: ${ref} 里没有这个文件（新增）`);
    continue;
  }
  const a = declarations(before);
  const b = declarations(fs.readFileSync(file, "utf8"));
  if (a.length !== b.length) {
    /* 条数变了说明不是纯替换——可能删了规则或加了规则，逐条比对失去意义。
       这不一定是错，但必须由人看一眼。 */
    structural.push(`${file}: 声明条数 ${a.length} → ${b.length}`);
    continue;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) { unchanged++; continue; }
    const key = `${a[i]} → ${b[i]}`;
    if (!changes.has(key)) changes.set(key, []);
    changes.get(key).push(`${file} 第 ${i + 1} 条`);
  }
}

console.log(`声明比对（解析 var 之后）  属性 ${propPattern}  ·  基准 ${ref}`);
console.log("=".repeat(58));
console.log(`  值不变的  ${unchanged}`);
console.log(`  值变了的  ${[...changes.values()].reduce((n, v) => n + v.length, 0)}`);
if (changes.size) {
  console.log("");
  for (const [key, where] of [...changes].sort((x, y) => y[1].length - x[1].length)) {
    console.log(`  ${String(where.length).padStart(3)}x  ${key}`);
    if (where.length <= 4) for (const w of where) console.log(`         ${w}`);
  }
}
if (structural.length) {
  console.log("\n  ⚠ 这些文件没法逐条比：");
  for (const s of structural) console.log(`     ${s}`);
}
console.log("=".repeat(58));
console.log("别名替换应当是 0 处变化；吸附的条数要跟提交信息里说的对上。");
