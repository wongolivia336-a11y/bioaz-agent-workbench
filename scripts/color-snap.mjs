/**
 * 把写死的十六进制色换成令牌——**只换角色对得上的那些**。
 *
 * 为什么不能像圆角那样一刀切
 * ----------------------------------------------------------------------
 * 圆角只有一个角色：把角磨圆。颜色不是——**同一个 `#fff`，当底色是「表面」，
 * 当文字是「深色按钮上的字」**。两者今天恰好都是白的，但它们会分头变：
 * 表面色以后可能调成米白，而深色按钮上的字必须一直是纯白。
 * 把 `color: #fff` 写成 `var(--bioaz-surface)`，视觉上今天一模一样，
 * 语义上已经错了，而错在哪儿要等有人改令牌那天才会暴露。
 *
 * 所以判据是「属性 × 令牌角色」，对不上就不换：
 *
 *   background / background-color  →  表面、画布、状态浅底、动作主色、品牌色
 *   color / fill                   →  文字、状态深色、品牌色、强调色
 *   border-color / outline-color   →  描边、强调描边
 *
 * 剩下的（`#fff` 当文字用、复合的 `border: 1px solid #xxx`、渐变、阴影）
 * 一律不动。**这个仓库缺一个「深色底上的文字」令牌**，补之前那批只能留着。
 *
 * 用法：
 *   node scripts/color-snap.mjs            只打印计划
 *   node scripts/color-snap.mjs --apply    落盘
 *
 * 落盘之后跑 `node scripts/token-diff.mjs --prop 'background|background-color|color|fill|border-color|outline-color'`，
 * 因为换的都是精确等值，**应当报 0 处变化**。
 */
import fs from "node:fs";

const apply = process.argv.includes("--apply");

const norm = (hex) => {
  let h = hex.toLowerCase().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return "#" + h;
};

/* 令牌表：颜色值 → 令牌名。只收 tokens.css 里直接写成 hex 的那些，
   套了一层 var() 的（比如 --bioaz-info: var(--bioaz-agent-accent)）不收——
   换成别名等于多绕一跳，读的人还得再查一次。 */
const tokens = new Map();
for (const m of fs.readFileSync("styles/tokens.css", "utf8").matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokens.set(norm(m[2]), m[1]);
}

/* 令牌角色。哪个令牌能用在哪类属性上。 */
const SURFACE = /^--bioaz-(surface|canvas|action-primary|brand-primary|agent-accent-soft|status-\w+-soft|info-soft)/;
const INK = /^--bioaz-(text|status-(neutral|running|warning|success|danger)$|success|warning|danger|brand-primary|agent-accent$|info$)/;
const LINE = /^--bioaz-(border|agent-accent-border)/;

const ROLE = [
  { props: /^(background|background-color)$/, allow: SURFACE },
  { props: /^(color|fill)$/, allow: INK },
  { props: /^(border-color|outline-color)$/, allow: LINE },
];

const files = fs.readdirSync("app").filter((f) => f.endsWith(".css")).map((f) => "app/" + f)
  .concat(["styles/design-system.css"]);

const plan = new Map();
let skippedRole = 0;
let skippedNoToken = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  /* 只认「属性: 单独一个 hex」这一种最简单的形态。
     `border: 1px solid #e7eaf0` 这类复合值不碰——拆开它要理解简写语法，
     而机械替换里每多一条规则就多一个出错的地方。 */
  const out = raw.replace(
    /(^|[;{\s])([a-z-]+)(\s*:\s*)(#[0-9a-fA-F]{3,8})(\s*)(?=[;}])/g,
    (whole, lead, prop, sep, hex, tail) => {
      const token = tokens.get(norm(hex));
      if (!token) { skippedNoToken++; return whole; }
      const rule = ROLE.find((r) => r.props.test(prop));
      if (!rule || !rule.allow.test(token)) { skippedRole++; return whole; }
      const key = `${prop}: ${norm(hex)} → var(${token})`;
      plan.set(key, (plan.get(key) ?? 0) + 1);
      return `${lead}${prop}${sep}var(${token})${tail}`;
    },
  );
  if (apply && out !== raw) fs.writeFileSync(file, out);
}

const total = [...plan.values()].reduce((n, v) => n + v, 0);
console.log(`可换 ${total} 处，${plan.size} 种组合` + (apply ? "（已落盘）" : "（只打印，加 --apply 才写）"));
console.log(`跳过：角色对不上 ${skippedRole} 处，令牌里没有这个色 ${skippedNoToken} 处`);
console.log("");
for (const [key, n] of [...plan].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}x  ${key}`);
}
