"use client";

import { Check } from "lucide-react";

type PlanStep = {
  id: string;
  label: string;
  state: "done" | "running" | "todo";
  owner: string;
};

type PlanStage = {
  id: string;
  name: string;
  summary: string;
  steps: PlanStep[];
};

const planStages: PlanStage[] = [
  {
    id: "stage-intake",
    name: "阶段一 · 数据准备",
    summary: "原始实验数据归集与口径确认",
    steps: [
      { id: "s1", label: "收集双批次原始数据", state: "done", owner: "Admin" },
      { id: "s2", label: "确认 Day28 测量口径", state: "done", owner: "王 SD" },
      { id: "s3", label: "补充历史对照组数据", state: "done", owner: "Admin" },
    ],
  },
  {
    id: "stage-analysis",
    name: "阶段二 · 分析与生成",
    summary: "由药效报告同事执行分析并产出报告",
    steps: [
      { id: "s4", label: "肿瘤体积趋势分析", state: "done", owner: "药效报告同事" },
      { id: "s5", label: "统计显著性校验", state: "running", owner: "药效报告同事" },
      { id: "s6", label: "生成报告初稿 v3", state: "running", owner: "药效报告同事" },
    ],
  },
  {
    id: "stage-review",
    name: "阶段三 · 审核与交付",
    summary: "专家小队审核后由负责人签核放行",
    steps: [
      { id: "s7", label: "发起专家小队审核", state: "todo", owner: "王 SD" },
      { id: "s8", label: "逐项确认专家建议", state: "todo", owner: "王 SD" },
      { id: "s9", label: "签核并生成交付包", state: "todo", owner: "王 SD" },
    ],
  },
];

const stepStateLabel: Record<PlanStep["state"], string> = {
  done: "已完成",
  running: "进行中",
  todo: "未开始",
};

export function ProjectPlanTab({ project }: { project: string }) {
  return (
    <section className="projectTabPanel projectPlanPanel">
      <div className="projectTabIntro">
        <strong>项目计划</strong>
        <span>{project} 的阶段式工作结构与当前进度。</span>
      </div>
      <div className="projectPlanStages">
        {planStages.map((stage) => {
          const done = stage.steps.filter((step) => step.state === "done").length;
          return (
            <article className="projectPlanStage" key={stage.id}>
              <header>
                <div>
                  <strong>{stage.name}</strong>
                  <small>{stage.summary}</small>
                </div>
                <span className="projectPlanProgress">{done}/{stage.steps.length}</span>
              </header>
              <ul>
                {stage.steps.map((step) => (
                  <li key={step.id} className={`projectPlanStep is-${step.state}`}>
                    <span className="projectPlanStepMark" aria-hidden="true">
                      {step.state === "done" ? <Check size={13} /> : null}
                    </span>
                    <span className="projectPlanStepLabel">{step.label}</span>
                    <small>{step.owner}</small>
                    <em>{stepStateLabel[step.state]}</em>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="projectTabPlaceholderNote">当前为示意数据，后续将接入真实项目计划。</p>
    </section>
  );
}
