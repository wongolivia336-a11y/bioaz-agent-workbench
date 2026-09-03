/**
 * 把 10px / 14px 两族圆角吸附到令牌刻度上。
 *
 * 为什么这两个要单独一个脚本
 * ----------------------------------------------------------------------
 * 前几批（9→8、7→8、11→12、13→12）都是「离哪一档近就归哪一档」，一条命令扫完。
 * 10 和 14 卡在正中间：10 离 tool 和 control 都是 2px，14 离 control 和
 * container 都是 2px。**没有一个数值规则能决定往哪边靠**——
 * chip 上的 10px 该收到 8，菜单上的 10px 该收到 12。
 *
 * 所以判据换成元素的**性质**，而不是它的数值：
 *
 *   10px 一族   可点的小控件（图标钮、按钮、输入框、chip）→ tool 8px
 *               浮层与卡片（菜单、弹窗、卡片、表格、纸面）→ control 12px
 *
 *   14px 一族   容器（卡片、弹窗、菜单、composer、面板）→ container 16px
 *               可点控件（图标钮、按钮、身份选择器）→ control 12px
 *
 * 判性质靠同一条规则里的尺寸声明：等宽等高且 ≤48px 的是图标钮；
 * 有 height / min-height ≤48px 的是一行控件；其余按容器算。
 * 判不准的写进 OVERRIDES，**手写的那几条就是这次的判断本身，要能被复查**。
 *
 * 用法：
 *   node scripts/radius-snap.mjs 10px          只打印分配表
 *   node scripts/radius-snap.mjs 10px --apply  落盘
 *
 * 落盘之后必须跑 `node scripts/radius-diff.mjs`，条数要跟这里打印的对上。
 */
import fs from "node:fs";

const TOKENS = { tool: "var(--bioaz-radius-tool)", control: "var(--bioaz-radius-control)", container: "var(--bioaz-radius-container)" };

/* 启发式判不准的。左边是选择器，右边写的是这一处的**性质**（icon / line / block），
   不是它该落到哪一档——档位由下面的 STEP 表按 value 决定。
   这两件事第一版写混了：`.taskExampleGrid button` 是张 132px 高的卡，
   直接写成 "control" 时，10px 那批凑巧对（block→control），
   14px 那批就错了（它该是 block→container）。**性质只有一个，档位有两套。**

   每加一条都等于说「这一处我看过了，它是这个性质」。 */
const OVERRIDES = {
  // 看着像控件、其实是浮层或纸面
  ".roleSelectorHelp > span": "block",       // 240px 宽的说明气泡，不是控件
  ".assistantContextBar .compactSelectMenu": "block",
  ".previewTable": "block",
  ".knowledgeTable": "block",
  ".quotationTable": "block",
  ".quoteDoc": "block",                      // 纸面
  ".quoteSheet, .quoteDoc": "block",
  ".taskExampleGrid button": "block",        // 100+px 高的卡，是卡不是按钮
  ".quotationAdmin>button": "block",         // height:auto 的整块
  ".emptyListState": "block",
  ".businessRuleCard": "block",
  // 看着像容器、其实是控件
  ".attachIconButton": "icon",
  ".sendIconButton": "icon",
  ".previewIconOnlyButton": "icon",
  ".newTaskComposer.workbenchComposer > .sendIconButton": "icon",
  ".roleSelectorCurrent": "line",
  ".decisionPrimary, .decisionIcon": "line",
  ".floatingChatBroadcast button": "line",
  ".figureThumbs button": "line",
  ".libraryAssistant .workspaceAssistantLauncher": "line", // 58px 高的启动条
};

const value = process.argv[2];
const apply = process.argv.includes("--apply");
if (!["10px", "14px"].includes(value)) {
  console.error("用法：node scripts/radius-snap.mjs <10px|14px> [--apply]");
  process.exit(1);
}

const size = (body, prop) => {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`));
  if (!m) return null;
  const px = m[1].trim().match(/^(\d+(?:\.\d+)?)px$/);
  return px ? Number(px[1]) : null;
};

/* 选择器直接说明性质的那些。
   压缩过的样式表里很多按钮/输入框只写了 padding 不写 height，光靠尺寸判不出来，
   会被当成容器——`.quotationDrawer input` 就是这么被判成 control 的。
   末段是交互元素的，一律按控件算；菜单/弹窗一类反过来一律按容器算。 */
const CONTROL_TAIL = /(?:^|[\s>,])(?:button|input|select|textarea|label|a)$|Button$|Chip$|Tag$|Icon$|Avatar$|Mark$/;
const BLOCK_WORD = /Menu$|Popover$|Dialog$|Modal$|Card$|Panel$|Table$|Tooltip$|Notice$|Sheet$|Doc$/;

/** 这条规则画的是控件还是容器。 */
function shape(selector, body) {
  for (const [key, verdict] of Object.entries(OVERRIDES)) if (selector === key) return verdict;
  /* 分组选择器按第一段判——同一条规则里的几个选择器性质本来就该一致，
     不一致说明那条规则本身把两种东西混在了一起，那是另一个问题。 */
  const head = selector.split(",")[0].trim();
  if (BLOCK_WORD.test(head)) return "block";
  if (CONTROL_TAIL.test(head)) return "line";
  const w = size(body, "width"), h = size(body, "height");
  if (w !== null && h !== null && w === h && w <= 48) return "icon";     // 图标钮
  const line = h ?? size(body, "min-height");
  if (line !== null && line <= 48) return "line";                        // 一行高的控件
  /* 「贴着内容那么宽」+ 小字号 = chip。它没有高度声明，但绝不是容器。 */
  if (/width:\s*fit-content/.test(body) && (size(body, "font-size") ?? 99) <= 13) return "line";
  return "block";                                                        // 容器
}

/* 性质 → 档位。同一个性质在两族里落到不同档，因为两族本来就差一档。 */
const STEP = {
  "10px": { icon: "tool", line: "tool", block: "control" },
  "14px": { icon: "control", line: "control", block: "container" },
};

const files = fs.readdirSync("app").filter((f) => f.endsWith(".css")).map((f) => "app/" + f)
  .concat(["styles/design-system.css"]);

const plan = [];
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));
  let out = raw;
  const edits = [];
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    const body = m[2];
    const decl = body.match(new RegExp(`border-radius:\\s*${value}\\s*(?=[;}])`));
    if (!decl) continue;
    const step = STEP[value][shape(selector, body)];
    edits.push({ selector, step, at: m.index + m[1].length + 1 + decl.index, len: decl[0].length });
    plan.push({ file, selector, step });
  }
  if (apply && edits.length) {
    /* 从后往前替换，前面的偏移量才不会被改动挪掉。 */
    for (const e of edits.sort((a, b) => b.at - a.at)) {
      out = out.slice(0, e.at) + `border-radius: ${TOKENS[e.step]}` + out.slice(e.at + e.len);
    }
    fs.writeFileSync(file, out);
  }
}

const byStep = plan.reduce((acc, p) => ((acc[p.step] = (acc[p.step] ?? 0) + 1), acc), {});
console.log(`${value} 共 ${plan.length} 处` + (apply ? "（已落盘）" : "（只打印，加 --apply 才写）"));
console.log("  " + Object.entries(byStep).map(([k, n]) => `${k} ${n}`).join("   "));
console.log("");
for (const p of plan) console.log(`  ${p.step.padEnd(10)} ${p.selector.slice(0, 62).padEnd(64)} ${p.file}`);
