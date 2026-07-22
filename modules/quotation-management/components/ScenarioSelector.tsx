"use client";

import { ChevronRight, FlaskConical } from "lucide-react";

export type DetectionScenario = "pk" | "ba-only" | "tox";

const scenarios: Array<{ id: DetectionScenario; label: string; description: string; status: string }> = [
  { id: "pk", label: "PK 检测", description: "药代动力学检测报价规则", status: "已发布" },
  { id: "ba-only", label: "BA Only 检测", description: "生物等效性检测报价规则", status: "已发布" },
  { id: "tox", label: "TOX 检测", description: "毒理学检测报价规则", status: "已发布" },
];

export default function ScenarioSelector({ onSelect }: { onSelect: (scenario: DetectionScenario) => void }) {
  return (
    <section className="quotationManagementPage">
      <header className="quotationPageHeader">
        <div>
          <span>DMPK QUOTATION</span>
          <h1>选择检测场景</h1>
          <p>选择一个检测场景，管理其标准价格、计价规则、报价字段与报价模板。</p>
        </div>
      </header>
      <div className="quotationBusinessGrid">
        {scenarios.map((scenario) => (
          <button type="button" key={scenario.id} onClick={() => onSelect(scenario.id)}>
            <span className="quotationBusinessIcon"><FlaskConical size={21} /></span>
            <strong>{scenario.label}</strong>
            <small>{scenario.description}</small>
            <footer>
              <em>{scenario.status}</em>
              <span>进入<ChevronRight size={15} /></span>
            </footer>
          </button>
        ))}
      </div>
    </section>
  );
}
