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
 * 复合值（`border: 1px solid #xxx`）、渐变、阴影一律不动——拆简写要理解语法，
 * 机械替换里每多一条规则就多一个出错的地方。
 *
 * `#fff` 当文字用的那批，现在有 `--bioaz-text-inverse` 收了。
 * 同一个 hex 有两个都对的令牌（surface / text-inverse），
 * 靠下面的角色表分流——见 tokens 那段注释。
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

/* 令牌表：颜色值 → **候选令牌列表**。只收 tokens.css 里直接写成 hex 的那些，
   套了一层 var() 的（比如 --bioaz-info: var(--bioaz-agent-accent)）不收——
   换成别名等于多绕一跳，读的人还得再查一次。

   为什么是列表不是单值
   ----------------------------------------------------------------------
   同一个值可以有**两个都对的令牌**，这正是这个脚本存在的理由：
   `#ffffff` 既是 --bioaz-surface（表面），也是 --bioaz-text-inverse
   （深色底上的文字）。存成 `hex → 名字` 的话，后声明的那个会把前一个
   顶掉，于是 `background: #fff` 和 `color: #fff` 里必然有一边拿到错的令牌，
   而且换哪一边错取决于**它们在 tokens.css 里的先后顺序**——
   这种依赖声明顺序的结果，是最难在 review 里看出来的一类错。
   存成列表，再按属性角色挑，两边就都能对。 */
const tokens = new Map();
for (const m of fs.readFileSync("styles/tokens.css", "utf8").matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  const key = norm(m[2]);
  if (!tokens.has(key)) tokens.set(key, []);
  tokens.get(key).push(m[1]);
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
const roleMisses = new Map();
let skippedRole = 0;
let skippedNoToken = 0;
let skippedAlias = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  /* 只认「属性: 单独一个 hex」这一种最简单的形态。
     `border: 1px solid #e7eaf0` 这类复合值不碰——拆开它要理解简写语法，
     而机械替换里每多一条规则就多一个出错的地方。 */
  const out = raw.replace(
    /(^|[;{\s])([a-z-]+)(\s*:\s*)(#[0-9a-fA-F]{3,8})(\s*)(?=[;}])/g,
    (whole, lead, prop, sep, hex, tail) => {
      /* `--ink: #111318` 这种是**旧别名层在定义自己**，不是某处在用一个颜色。
         把它换成 var(--bioaz-text-primary) 是另一件事（给别名层搭桥），
         风险和判据都不一样：那一步会改变 --ink 在全仓库的含义。
         混在这个脚本里做，等于让一次「换个写法」的提交顺手改掉一层语义。 */
      if (prop.startsWith("--")) { skippedAlias++; return whole; }
      const candidates = tokens.get(norm(hex));
      if (!candidates) { skippedNoToken++; return whole; }
      const rule = ROLE.find((r) => r.props.test(prop));
      /* 候选里挑第一个角色对得上的。挑不到就原样留着——
         「这个值有令牌」和「这个令牌能用在这个属性上」是两件事。 */
      const token = rule && candidates.find((name) => rule.allow.test(name));
      if (!token) {
        skippedRole++;
        /* 记下来是哪一对没配上。这份清单就是「下一个该补哪个令牌」的答案：
           上一轮 66 处 `color: #fff` 挂在这里，补了 --bioaz-text-inverse 才收掉。
           只报一个总数的话，没人知道该往哪儿使劲。 */
        const k = `${prop}: ${norm(hex)}（候选 ${candidates.join(" / ")}）`;
        roleMisses.set(k, (roleMisses.get(k) ?? 0) + 1);
        return whole;
      }
      const key = `${prop}: ${norm(hex)} → var(${token})`;
      plan.set(key, (plan.get(key) ?? 0) + 1);
      return `${lead}${prop}${sep}var(${token})${tail}`;
    },
  );
  if (apply && out !== raw) fs.writeFileSync(file, out);
}

const total = [...plan.values()].reduce((n, v) => n + v, 0);
console.log(`可换 ${total} 处，${plan.size} 种组合` + (apply ? "（已落盘）" : "（只打印，加 --apply 才写）"));
console.log(`跳过：角色对不上 ${skippedRole} 处，令牌里没有这个色 ${skippedNoToken} 处，旧别名层的定义 ${skippedAlias} 处`);
console.log("");
for (const [key, n] of [...plan].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}x  ${key}`);
}

if (roleMisses.size) {
  console.log("");
  console.log("角色对不上的（值有令牌，但那个令牌不该用在这个属性上）：");
  for (const [key, n] of [...roleMisses].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}x  ${key}`);
  }
  console.log("  ↑ 数量大的那几行就是下一个该补的令牌。");
}
