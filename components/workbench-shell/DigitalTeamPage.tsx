"use client";

import { ArrowLeft, Bot, ChevronRight, Folder, Network, Search, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { aggregateSkills, digitalScenarios, digitalTeamData, mcpData, type DigitalCoworker, type DigitalSkill, type DigitalSubAgent } from "../../lib/workbench/digitalTeamData";
import type { WorkbenchProject, WorkbenchTask } from "../../modules/types";
import { McpTab } from "./McpTab";
import { SkillsTab } from "./SkillsTab";
import { EmptyState, NavTabs } from "../ui";

type Props = {
  projects: WorkbenchProject[];
  tasks: WorkbenchTask[];
  onStartModule: (moduleId: string) => void;
  onOpenLibrary: () => void;
};

type TeamTab = "coworkers" | "skills" | "mcp";

const teamTabs: Array<{ id: TeamTab; label: string }> = [
  { id: "coworkers", label: "数字同事" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" },
];

const domains = ["全部领域", ...Array.from(new Set(digitalTeamData.map((item) => item.domain)))];

// 计数直接挂在 Tab 上，替代原来占一屏的 hero
const tabCounts: Record<TeamTab, number> = {
  coworkers: digitalTeamData.length,
  skills: aggregateSkills().length,
  mcp: mcpData.length,
};

const searchPlaceholder: Record<TeamTab, string> = {
  coworkers: "搜索数字同事、技能或业务领域",
  skills: "搜索 Skill 名称或说明",
  mcp: "搜索连接器或所属系统",
};

export function DigitalTeamPage({ projects, tasks, onStartModule, onOpenLibrary }: Props) {
  const [selectedId, setSelectedId] = useState(digitalTeamData[1]?.id ?? digitalTeamData[0].id);
  const [view, setView] = useState<"gallery" | "detail">("gallery");
  const [activeTab, setActiveTab] = useState<TeamTab>("coworkers");
  const [query, setQuery] = useState("");
  const [topbarHost, setTopbarHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setTopbarHost(document.getElementById("workbench-topbar-actions")); }, []);
  const [domain, setDomain] = useState(domains[0]);
  const [useOpen, setUseOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selected = digitalTeamData.find((item) => item.id === selectedId) ?? digitalTeamData[0];
  const selectedNode = getSelectedNode(selected, selectedNodeId);

  const openCoworker = (id: string) => {
    setSelectedId(id);
    setUseOpen(false);
    setSelectedNodeId(null);
    setView("detail");
  };

  const filteredCoworkers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return digitalTeamData.filter((item) => {
      const matchesDomain = domain === "全部领域" || item.domain === domain;
      const matchesKeyword = !keyword || [item.displayName, item.domain, item.description, ...item.skills.map((skill) => skill.name)].some((value) => value.toLowerCase().includes(keyword));
      return matchesDomain && matchesKeyword;
    });
  }, [domain, query]);

  const useCoworker = () => {
    if (selected.moduleId) {
      onStartModule(selected.moduleId);
      return;
    }
    if (selected.id === "file-assistant") {
      onOpenLibrary();
    }
  };

  if (view === "detail") {
    return (
      <section className="digitalTeamView digitalTeamDetailView" aria-label={`${selected.displayName}能力画布`}>
        <header className="digitalCoworkerDetailHeader">
          <div className="breadcrumb digitalTeamBreadcrumb">
            <button type="button" onClick={() => { setView("gallery"); setUseOpen(false); setSelectedNodeId(null); }}>数字团队</button>
            <ChevronRight size={15} />
            <button type="button" onClick={() => setSelectedNodeId(null)}>{selected.displayName}</button>
            <ChevronRight size={15} />
            <strong>{selectedNode?.title ?? "能力画布"}</strong>
          </div>
          <div className="digitalCoworkerTitleRow">
            <button type="button" onClick={() => { setView("gallery"); setUseOpen(false); setSelectedNodeId(null); }} aria-label="返回数字团队">
              <ArrowLeft size={17} />
            </button>
            <span><Bot size={24} /></span>
            <div>
              <small>{selected.domain}</small>
              <h1>{selected.displayName}</h1>
              <p>{selected.description}</p>
            </div>
            <section className="digitalUseBox">
              <button className="digitalUsePrimary" type="button" onClick={() => setUseOpen((value) => !value)}>
                <Sparkles size={16} />使用这个同事
              </button>
              {useOpen ? (
                <div className="digitalUseMenu">
                  <button type="button" onClick={useCoworker}><Zap size={14} />用于新任务</button>
                  <button type="button"><Folder size={14} />接入已有项目<span>{projects[0]?.name ?? "选择项目"}</span></button>
                  <button type="button"><Bot size={14} />继续已有任务<span>{tasks[0]?.title ?? "暂无运行任务"}</span></button>
                </div>
              ) : null}
            </section>
          </div>
        </header>

        <div className="digitalCanvasLayout">
          <section className="digitalCapabilityCanvas" aria-label="核心协作链路">
            <div className="digitalCanvasRail horizontal" />
            <div className="digitalCanvasRail vertical" />
            <CanvasNode
              className="center"
              variant="coworker"
              label={selected.displayName}
              meta="数字同事"
              active={!selectedNodeId}
              onClick={() => setSelectedNodeId(null)}
            />
            {selected.skills.slice(0, 4).map((skill, index) => (
              <CanvasNode
                className={`skill skill-${index}`}
                variant="skill"
                key={skill.id}
                label={skill.name}
                meta={skill.category}
                active={selectedNodeId === skill.id}
                onClick={() => setSelectedNodeId(skill.id)}
              />
            ))}
            {selected.subAgents.slice(0, 3).map((agent, index) => (
              <CanvasNode
                className={`subagent subagent-${index}`}
                variant="subagent"
                key={agent.id}
                label={agent.name}
                meta={agent.role}
                active={selectedNodeId === agent.id}
                onClick={() => setSelectedNodeId(agent.id)}
              />
            ))}
          </section>

          <aside className="digitalCanvasInspector">
            <span>{selectedNode?.kind ?? "数字同事"}</span>
            <h2>{selectedNode?.title ?? selected.displayName}</h2>
            <p>{selectedNode?.description ?? selected.description}</p>
            <div className="subagentNotice">
              <Network size={15} />
              <span>一个数字同事由多个 SubAgent 协作构成，当前有 {selected.subAgents.length} 个 SubAgent、{selected.skills.length} 个 Skill。</span>
            </div>
            <div>
              <strong>适用任务</strong>
              {selected.taskExamples.map((example) => <button type="button" key={example}>{example}</button>)}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="digitalTeamView" aria-label="数字团队">
      {/* 搜索框统一挂在顶栏工具层，与项目中枢、知识库同一位置 */}
      {topbarHost ? createPortal(
        <div className="libraryToolLayer">
          <label className="knowledgeSearch libraryToolSearch">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder[activeTab]} aria-label={searchPlaceholder[activeTab]} />
          </label>
        </div>,
        topbarHost,
      ) : null}

      <NavTabs
        className="digitalTeamTabs"
        items={teamTabs.map((tab) => ({ ...tab, count: tabCounts[tab.id] }))}
        value={activeTab}
        onChange={(id) => { setActiveTab(id); setQuery(""); }}
        label="数字团队"
      />

      {activeTab === "coworkers" ? (
        <>
          <section className="digitalScenarioStrip" aria-label="精选场景">
            <div className="digitalScenarioHeading"><strong>精选场景</strong><span>按业务场景快速找到该用哪几位数字同事</span></div>
            <div className="digitalScenarioRow">
              {digitalScenarios.map((scenario) => (
                <article className="digitalScenarioCard" key={scenario.id}>
                  <strong>{scenario.name}</strong>
                  <small>{scenario.description}</small>
                  <div>
                    {scenario.coworkerIds.map((id) => {
                      const coworker = digitalTeamData.find((item) => item.id === id);
                      if (!coworker) return null;
                      return (
                        <button type="button" key={id} onClick={() => openCoworker(id)}>
                          <span><Bot size={14} /></span>{coworker.displayName}
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="digitalFilterChips" role="tablist" aria-label="业务领域">
            {domains.map((item) => (
              <button
                key={item}
                className={`digitalFilterChip ${domain === item ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={domain === item}
                onClick={() => setDomain(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="digitalCoworkerGrid">
            {filteredCoworkers.map((coworker) => (
              <button
                className={`digitalCoworkerCard ${selected.id === coworker.id ? "active" : ""}`}
                type="button"
                key={coworker.id}
                onClick={() => openCoworker(coworker.id)}
              >
                <header>
                  <span><Bot size={18} /></span>
                  <em>{coworker.status === "active" ? "已启用" : "规划中"}</em>
                </header>
                <strong>{coworker.displayName}</strong>
                <small>{coworker.domain}</small>
                <p>{coworker.description}</p>
                <footer>
                  <span>{coworker.skills.length} Skills</span>
                  <span>{coworker.subAgents.length} SubAgents</span>
                  <ChevronRight size={15} />
                </footer>
              </button>
            ))}
            {!filteredCoworkers.length ? <EmptyState variant="inline" title="没有匹配的数字同事" /> : null}
          </div>
        </>
      ) : activeTab === "skills" ? <SkillsTab query={query} /> : <McpTab query={query} />}
    </section>
  );
}

function CanvasNode({
  className,
  variant,
  label,
  meta,
  active,
  onClick,
}: {
  className: string;
  variant: "coworker" | "skill" | "subagent";
  label: string;
  meta: string;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = variant === "skill" ? Sparkles : variant === "subagent" ? Network : Bot;
  const tag = variant === "skill" ? "Skill" : variant === "subagent" ? "SubAgent" : "Coworker";
  return (
    <button className={`digitalCanvasNode ${variant} ${className} ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <em>{tag}</em>
      <span><Icon size={16} /></span>
      <strong>{label}</strong>
      <small>{meta}</small>
    </button>
  );
}

function getSelectedNode(coworker: DigitalCoworker, nodeId: string | null): { kind: string; title: string; description: string } | null {
  if (!nodeId) return null;
  const skill = coworker.skills.find((item: DigitalSkill) => item.id === nodeId);
  if (skill) return { kind: "Skill", title: skill.name, description: skill.description };
  const agent = coworker.subAgents.find((item: DigitalSubAgent) => item.id === nodeId);
  if (agent) return { kind: "SubAgent", title: agent.name, description: agent.description };
  return null;
}

export default DigitalTeamPage;
