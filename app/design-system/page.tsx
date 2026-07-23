import { ArrowLeft, ArrowUpRight, Download, MoreHorizontal, Pin, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionCard, Button, IconButton, SurfaceCard } from "../../components/ui";

const colors = [
  { label: "Brand Primary", value: "#2900FF", color: "var(--bioaz-brand-primary)" },
  { label: "Agent Accent", value: "#5C60B8", color: "var(--bioaz-agent-accent)" },
  { label: "Canvas", value: "#F7F8FA", color: "var(--bioaz-canvas)" },
  { label: "Surface", value: "#FFFFFF", color: "var(--bioaz-surface)" },
  { label: "Success", value: "#60756A", color: "var(--bioaz-success)" },
  { label: "Warning", value: "#7B705A", color: "var(--bioaz-warning)" },
  { label: "Danger", value: "#876B68", color: "var(--bioaz-danger)" },
  { label: "Border", value: "#E7EAF0", color: "var(--bioaz-border)" },
];

export default function DesignSystemPage() {
  return (
    <div className="bioazDesignSystemPage">
      <header className="bioazDesignSystemHeader">
        <strong>BioAZ Design System</strong>
        <Link href="/"><ArrowLeft size={14} /> 返回 Workbench</Link>
      </header>
      <main className="bioazDesignSystemMain">
        <section className="bioazDesignSystemIntro">
          <h1>Clinical Canvas Foundations</h1>
          <p>面向 BioAZ Agent Workbench 的可执行设计规范。第一批覆盖 Foundation Tokens、Button、IconButton、Surface Card 与 Action Card。</p>
        </section>

        <section className="bioazDesignSystemSection">
          <h2>Color tokens</h2>
          <div className="bioazDesignSystemGrid">
            {colors.map((color) => (
              <div className="bioazTokenSwatch" key={color.label} style={{ background: color.color }}>
                <strong>{color.label}</strong>
                <small>{color.value}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="bioazDesignSystemSection">
          <h2>Buttons</h2>
          <p>一个操作区域原则上只有一个 Primary。Loading 保留动作文字并锁定宽度。</p>
          <div className="bioazDesignSystemRow">
            <Button variant="primary" leadingIcon={<Plus size={16} />}>创建任务</Button>
            <Button variant="secondary" leadingIcon={<Download size={16} />}>导出</Button>
            <Button variant="ghost">取消</Button>
            <Button variant="danger" leadingIcon={<Trash2 size={16} />}>删除任务</Button>
            <Button variant="primary" loading>正在生成</Button>
            <Button disabled>不可用</Button>
          </div>
          <div className="bioazDesignSystemRow">
            <Button size="small">Small 32</Button>
            <Button size="default">Default 40</Button>
            <Button size="large" variant="primary">Large 44</Button>
          </div>
        </section>

        <section className="bioazDesignSystemSection">
          <h2>Icon buttons</h2>
          <p>熟悉图标提供可访问名称；陌生和低频动作同时提供 Tooltip。</p>
          <div className="bioazDesignSystemRow">
            <IconButton size="compact" icon={<MoreHorizontal size={14} />} label="更多操作" />
            <IconButton icon={<Pin size={16} />} label="固定" />
            <IconButton selected icon={<Pin size={16} />} label="取消固定" />
            <IconButton disabled icon={<Download size={16} />} label="下载不可用" />
          </div>
        </section>

        <section className="bioazDesignSystemSection">
          <h2>Cards</h2>
          <div className="bioazDesignSystemGrid">
            <SurfaceCard className="bioazCardDemo">
              <h3>Surface Card</h3>
              <p>用于任务摘要、上下文和静态信息分组。默认不可点击，也没有 hover 抬升。</p>
            </SurfaceCard>
            <ActionCard className="bioazCardDemo">
              <ArrowUpRight size={18} />
              <h3>Action Card</h3>
              <p>进入一个能力或流程。Hover 时使用低强调紫色交互光效。</p>
            </ActionCard>
            <SurfaceCard density="compact" className="bioazCardDemo">
              <h3>Compact 12</h3>
              <p>Inspector 与紧凑摘要。</p>
            </SurfaceCard>
            <SurfaceCard density="spacious" className="bioazCardDemo">
              <h3>Spacious 24</h3>
              <p>首页入口和大型任务概览。</p>
            </SurfaceCard>
          </div>
        </section>
      </main>
    </div>
  );
}
