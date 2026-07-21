"use client";

import { Check, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import type { DetectionScenario } from "../components/ScenarioSelector";

interface TemplateItem {
  id: string;
  name: string;
  version: string;
  date: string;
  format: string;
  status: "published" | "draft";
}

const pkTemplates: TemplateItem[] = [
  { id: "pk-t1", name: "PK 标准报价单", version: "v8", date: "2026-07-15", format: "Excel + Word", status: "published" },
  { id: "pk-t2", name: "PK 报价明细", version: "v5", date: "2026-06-20", format: "Excel", status: "published" },
  { id: "pk-t3", name: "PK 快速报价", version: "v2", date: "2026-05-08", format: "Word", status: "draft" },
];

const baTemplates: TemplateItem[] = [
  { id: "ba-t1", name: "BA Only 报价单", version: "v4", date: "2026-07-15", format: "Excel + Word", status: "published" },
  { id: "ba-t2", name: "BA 报价明细", version: "v3", date: "2026-06-20", format: "Excel", status: "published" },
];

const toxTemplates: TemplateItem[] = [
  { id: "tox-t1", name: "TOX 标准报价单", version: "v2", date: "2026-07-10", format: "Excel + Word", status: "published" },
  { id: "tox-t2", name: "TOX 报价明细", version: "v1", date: "2026-06-15", format: "Excel", status: "published" },
  { id: "tox-t3", name: "TOX 快速报价", version: "v1", date: "2026-05-20", format: "Word", status: "draft" },
];

const scenarioTemplates: Record<DetectionScenario, TemplateItem[]> = {
  pk: pkTemplates,
  "ba-only": baTemplates,
  tox: toxTemplates,
};

export default function TemplateConfig({ scenario, onView }: { scenario: DetectionScenario; onView: () => void }) {
  const templates = scenarioTemplates[scenario] ?? pkTemplates;
  const [activeTemplate, setActiveTemplate] = useState(templates[0]?.id ?? "");
  const selected = templates.find((item) => item.id === activeTemplate) ?? templates[0];

  return (
    <div className="quotationTemplateWorkspace">
      <div className="quotationTemplateScenarioGrid">
        {templates.map((template) => (
          <article className={template.id === activeTemplate ? "active" : ""} key={template.id} onClick={() => setActiveTemplate(template.id)}>
            <header>
              <span><FileSpreadsheet size={18} /></span>
              <em><Check size={12} />{template.status === "published" ? "已发布" : "草稿"}</em>
            </header>
            <strong>{template.name}</strong>
            <small>当前版本 {template.version} · {template.format}</small>
            <footer>
              <button type="button" onClick={(event) => { event.stopPropagation(); onView(); }}>预览</button>
              <span>{template.format} <ChevronRight size={14} /></span>
            </footer>
          </article>
        ))}
      </div>
      {selected ? (
        <section className="quotationTemplateHistory">
          <header>
            <div>
              <h2>{selected.name} · 版本记录</h2>
              <small>当前与历史版本</small>
            </div>
            <span>{templates.length} 个版本</span>
          </header>
          {templates.map((template) => (
            <button type="button" key={template.id} onClick={onView}>
              <strong>{template.version}</strong>
              <span>{template.id === activeTemplate ? "当前使用" : "历史版本"}</span>
              <small>{template.date}</small>
              <ChevronRight size={15} />
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
