"use client";

import { Check, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

const templates = [
  { id: "pk", title: "PK 标准报价单", version: "v8", date: "2026-07-15", count: 8 },
  { id: "ba", title: "BA Only 报价单", version: "v4", date: "2026-07-15", count: 4 },
  { id: "tox", title: "TOX 标准报价单", version: "v2", date: "2026-07-10", count: 2 },
];

export default function TemplateConfig({ onView }: { onView: () => void }) {
  const [activeTemplate, setActiveTemplate] = useState("pk");
  const selected = templates.find((item) => item.id === activeTemplate) ?? templates[0];

  return (
    <div className="quotationTemplateWorkspace">
      <div className="quotationTemplateScenarioGrid">
        {templates.map((template) => (
          <article className={template.id === activeTemplate ? "active" : ""} key={template.id} onClick={() => setActiveTemplate(template.id)}>
            <header>
              <span><FileSpreadsheet size={18} /></span>
              <em><Check size={12} />已发布</em>
            </header>
            <strong>{template.title}</strong>
            <small>当前版本 {template.version} · Excel 与 Word</small>
            <footer>
              <button type="button" onClick={(event) => { event.stopPropagation(); setActiveTemplate(template.id); onView(); }}>预览</button>
              <span>{template.count} 个版本 <ChevronRight size={14} /></span>
            </footer>
          </article>
        ))}
      </div>
      <section className="quotationTemplateHistory">
        <header>
          <div>
            <h2>{selected.title} · 版本记录</h2>
            <small>当前与历史版本</small>
          </div>
          <span>共 {selected.count} 个版本</span>
        </header>
        {[[selected.version, "当前使用", selected.date], [selected.id === "pk" ? "v7" : selected.id === "ba" ? "v3" : "v1", "历史版本", "2026-06-20"], [selected.id === "pk" ? "v6" : "—", "历史版本", "2026-05-08"]]
          .filter((item) => item[0] !== "—")
          .map(([version, status, date]) => (
            <button type="button" key={version} onClick={onView}>
              <strong>{version}</strong>
              <span>{status}</span>
              <small>{date}</small>
              <ChevronRight size={15} />
            </button>
          ))}
      </section>
    </div>
  );
}
