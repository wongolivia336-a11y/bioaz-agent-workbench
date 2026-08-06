import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DesignSystemExamples } from "./DesignSystemExamples";

type Token = { name: string; value: string; group: string };

const groupOf = (name: string) => {
  if (name.includes("color") || /(brand|action|agent|text|canvas|surface|border|success|warning|danger|info|status)/.test(name)) return "Color";
  if (name.includes("radius")) return "Radius";
  if (name.includes("space")) return "Spacing";
  if (name.includes("type") || name.includes("font")) return "Typography";
  if (name.includes("shadow")) return "Elevation";
  if (name.includes("motion") || name.includes("duration") || name.includes("ease")) return "Motion";
  return "Other";
};

function readTokens(): Token[] {
  const source = readFileSync(join(process.cwd(), "styles", "tokens.css"), "utf8");
  return Array.from(source.matchAll(/^\s*(--bioaz-[\w-]+):\s*([^;]+);/gm), ([, name, value]) => ({
    name,
    value: value.replace(/\s+/g, " ").trim(),
    group: groupOf(name),
  }));
}

const components = [
  { name: "Button / IconButton", status: "stable", props: "variant, size, loading, disabled, leadingIcon, icon, label, selected", use: "明确操作、工具栏图标操作", avoid: "不要模拟导航或 Tab；同一区域避免多个 Primary" },
  { name: "SurfaceCard / ActionCard", status: "stable", props: "density, className, HTML attributes", use: "静态信息分组或整体可点击入口", avoid: "SurfaceCard 不添加点击语义；不要用卡片包裹所有内容" },
  { name: "Menu / MenuGroup / MenuItem", status: "stable", props: "icon, label, active, align, closeOnSelect", use: "筛选、排序和低频工具操作", avoid: "高频主操作不要藏进菜单；多选必须关闭 closeOnSelect" },
  { name: "StatusChip", status: "stable", props: "tone, dot, className", use: "密集列表中的状态扫读", avoid: "不要把业务状态枚举塞进基础组件" },
  { name: "NavTabs / SegmentedControl", status: "stable", props: "items, value, onChange, label, className", use: "NavTabs 换内容；SegmentedControl 换呈现方式", avoid: "不要仅凭外观选择二者" },
  { name: "Dialog", status: "stable", props: "title, description, size, onClose, footer", use: "需要用户集中确认的模态任务", avoid: "轻量详情不使用；不要覆盖 footer 按钮尺寸" },
  { name: "Drawer", status: "stable", props: "title, eyebrow, onClose, className", use: "保持当前上下文的右侧详情", avoid: "完整工作流和高密度编辑不塞进抽屉" },
  { name: "EmptyState", status: "stable", props: "icon, title, description, action, variant", use: "空列表、首次进入和无结果状态", avoid: "不要堆多段解释或多个主行动" },
  { name: "WorkbenchComposer", status: "candidate", props: "attachments, activeCoworkerId, project, menu, globalDrop", use: "任务输入、附件与能力入口", avoid: "窄 Drawer 不启用二级菜单；同屏仅一个 globalDrop" },
  { name: "WorkbenchPanel / PanelToggle", status: "candidate", props: "panels, visibleIds, onVisibleIdsChange, activePanelId, onPanelChange, hintIds, open, onClose", use: "Agent 会话右侧工作面板：tab 栏 + 加号选面板 + 每个 tab 可叉掉；topbar 的 PanelToggle 负责折叠展开", avoid: "不要再和别的右侧浮层互斥；tab 清单固定，不做可重复实例；最后一个 tab 不可关闭" },
  { name: "SquadStatusCard", status: "candidate", props: "steps, elapsed, running", use: "多成员并行处理时的进度感知（专家小队审核）", avoid: "不要与同一份步骤数据的过程卡同时展开" },
];

export default function DesignSystemPage() {
  const tokens = readTokens();
  const groups = ["Color", "Typography", "Spacing", "Radius", "Elevation", "Motion", "Other"];

  return (
    <div className="bioazDesignSystemPage">
      <header className="bioazDesignSystemHeader">
        <strong>BioAZ Design System</strong>
        <Link href="/"><ArrowLeft size={14} /> 返回 Workbench</Link>
      </header>
      <main className="bioazDesignSystemMain">
        <section className="bioazDesignSystemIntro">
          <span className="bioazDsEyebrow">Developer & Agent Reference</span>
          <h1>BioAZ Interface Foundations</h1>
          <p>真实组件、设计 Token 与使用边界的可执行目录。Token 自动读取自 styles/tokens.css；设计判断与禁用场景由人工维护。</p>
          <div className="bioazDsSummary"><span>{tokens.length} Tokens</span><span>{components.filter((item) => item.status === "stable").length} Stable</span><span>{components.filter((item) => item.status === "candidate").length} Candidate</span></div>
        </section>

        <nav className="bioazDsIndex" aria-label="设计系统目录">
          <a href="#tokens">Foundations</a><a href="#components">Components</a><a href="#rules">Rules</a>
        </nav>

        <section className="bioazDesignSystemSection" id="tokens">
          <div className="bioazDsSectionHeading"><div><span>Foundations</span><h2>Token catalogue</h2></div><code>styles/tokens.css</code></div>
          {groups.map((group) => {
            const items = tokens.filter((token) => token.group === group);
            if (!items.length) return null;
            return <div className="bioazTokenGroup" key={group}><h3>{group}</h3><div className="bioazTokenList">{items.map((token) => <div className={`bioazTokenRow ${group === "Color" ? "hasSwatch" : ""}`} key={token.name}>{group === "Color" ? <i style={{ background: `var(${token.name})` }} /> : null}<code>{token.name}</code><span>{token.value}</span></div>)}</div></div>;
          })}
        </section>

        <section className="bioazDesignSystemSection" id="components">
          <div className="bioazDsSectionHeading"><div><span>Inventory</span><h2>Component catalogue</h2></div><code>components/ui</code></div>
          <div className="bioazComponentDocs">{components.map((component) => <article key={component.name}><header><h3>{component.name}</h3><em className={`is-${component.status}`}>{component.status}</em></header><dl><div><dt>Props</dt><dd><code>{component.props}</code></dd></div><div><dt>Use when</dt><dd>{component.use}</dd></div><div><dt>Avoid when</dt><dd>{component.avoid}</dd></div></dl></article>)}</div>
          <DesignSystemExamples />
        </section>

        <section className="bioazDesignSystemSection" id="rules">
          <div className="bioazDsSectionHeading"><div><span>Guidance</span><h2>Agent implementation rules</h2></div><code>AGENTS.md</code></div>
          <div className="bioazRuleGrid"><article><strong>Reuse primitives</strong><p>业务模块可以新增业务组件，但不得重复实现 components/ui 已有的基础组件。</p></article><article><strong>Name every color</strong><p>优先使用全局 --bioaz-* Token；业务特有颜色先声明模块语义 Token。</p></article><article><strong>Promote with evidence</strong><p>业务组件经过两个以上真实场景验证后，再考虑提升为共享 Primitive。</p></article></div>
        </section>
      </main>
    </div>
  );
}
