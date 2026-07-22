"use client";

import { ArrowLeft, ChevronRight, ChevronUp, LogOut, Settings, Settings2 } from "lucide-react";
import { useState } from "react";
import BusinessPicker from "./components/BusinessPicker";
import DmpkRuleAssistant from "./components/DmpkRuleAssistant";
import ManagementDialog from "./components/ManagementDialog";
import PriceDrawer from "./components/PriceDrawer";
import ScenarioSelector from "./components/ScenarioSelector";
import type { DetectionScenario } from "./components/ScenarioSelector";
import FieldConfig from "./dmpk/FieldConfig";
import PriceConfig from "./dmpk/PriceConfig";
import RuleConfig from "./dmpk/RuleConfig";
import TemplateConfig from "./dmpk/TemplateConfig";

type DmpkTab = "prices" | "rules" | "parameters" | "templates";
type ManagementDialogType = "import" | "new-price" | "parameter-preview" | "new-parameter" | "upload-template" | "view-template" | null;

const tabs: Array<{ id: DmpkTab; label: string }> = [
  { id: "prices", label: "标准价格" },
  { id: "rules", label: "计价规则" },
  { id: "parameters", label: "报价字段" },
  { id: "templates", label: "报价模板" },
];

const scenarioLabels: Record<DetectionScenario, string> = {
  pk: "PK 检测",
  "ba-only": "BA Only 检测",
  tox: "TOX 检测",
};

export function QuotationManagement({ onBack }: { onBack: () => void }) {
  const [business, setBusiness] = useState<"root" | "dmpk">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("business") === "dmpk" ? "dmpk" : "root");
  const [scenario, setScenario] = useState<DetectionScenario | null>(null);
  const [tab, setTab] = useState<DmpkTab>(() => { const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null; return tabs.some((item) => item.id === value) ? value as DmpkTab : "prices"; });
  const [editingPrice, setEditingPrice] = useState(false);
  const [dialog, setDialog] = useState<ManagementDialogType>(null);
  const [activeField, setActiveField] = useState(0);
  const [activeParameterGroup, setActiveParameterGroup] = useState("animal");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<string | null>(null);

  return (
    <main className="quotationManagementShell">
      <aside className="quotationManagementSidebar">
        <div className="quotationManagementBrand"><img src="/logo/bioaz-logo.svg" alt="" /><strong>BioAZ</strong></div>
        <button className="quotationBackButton" type="button" onClick={onBack}><ArrowLeft size={17} />返回工作台</button>
        <span className="quotationSidebarLabel">报价管理</span>
        <button className="quotationSidebarItem active" type="button" onClick={() => setBusiness("root")}><Settings2 size={17} />报价规则</button>
        <div className={`quotationAdmin ${adminMenuOpen ? "menuOpen" : ""}`}>
          <button type="button" onClick={() => setAdminMenuOpen((value) => !value)} aria-expanded={adminMenuOpen}>
            <span className="avatar">A</span>
            <span><strong>Admin</strong><small>admin@example.com</small></span>
            <ChevronUp size={15} />
          </button>
          {adminMenuOpen ? (
            <div className="quotationAdminMenu">
              <div><span className="avatar">A</span><span><strong>Admin</strong><small>admin@example.com</small></span></div>
              <button type="button"><Settings size={15} />账户设置</button>
              <button type="button"><LogOut size={15} />退出登录</button>
            </div>
          ) : null}
        </div>
      </aside>
      <section className="quotationManagementMain">
        <header className="quotationManagementTopbar topbar">
          <div className="breadcrumb quotationBreadcrumb">
            {business === "root" ? (
              <strong>报价规则</strong>
            ) : (
              <>
                <button type="button" onClick={() => { setBusiness("root"); setScenario(null); }}>报价规则</button>
                <ChevronRight size={15} />
                {scenario ? (
                  <>
                    <button type="button" onClick={() => setScenario(null)}>DMPK 报价</button>
                    <ChevronRight size={15} />
                    <button type="button" onClick={() => setScenario(null)}>{scenarioLabels[scenario]}</button>
                    <ChevronRight size={15} />
                    <strong>{tabs.find((item) => item.id === tab)?.label}</strong>
                  </>
                ) : (
                  <strong>DMPK 报价</strong>
                )}
              </>
            )}
          </div>
          <span className="quotationTopbarStatus">{business === "root" ? "管理员模式" : "草稿 2"}</span>
        </header>
        {business === "root" ? (
          <BusinessPicker onOpenDmpk={() => setBusiness("dmpk")} />
        ) : !scenario ? (
          <ScenarioSelector onSelect={(selected) => { setScenario(selected); setTab("prices"); }} />
        ) : (
          <section className="quotationManagementPage">
            <header className="quotationPageHeader">
              <div>
                <span>{scenarioLabels[scenario].toUpperCase()}</span>
                <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
                <p>{tab === "prices" ? "当前发布版本 v1.0.13" : tab === "rules" ? "管理不同检测条件下，费用如何计算。" : tab === "parameters" ? "配置报价任务需要确认的信息与常用选项。" : "管理客户最终收到的 Excel 与 Word 版式。"}</p>
              </div>
              {tab === "prices" ? (
                <div>
                  <button type="button" onClick={() => setDialog("import")}>导入 Excel</button>
                  <button className="primary" type="button" onClick={() => setDialog("new-price")}>新增价格</button>
                </div>
              ) : tab === "parameters" ? (
                <button className="primary" type="button" onClick={() => setDialog("parameter-preview")}>预览前台表单</button>
              ) : tab === "templates" ? (
                <button className="primary" type="button" onClick={() => setDialog("upload-template")}>上传新模板</button>
              ) : null}
            </header>
            <nav className="quotationTabs">
              {tabs.map((item) => (
                <button className={tab === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>
              ))}
            </nav>
            {tab === "prices" ? (
              <PriceConfig scenario={scenario} onEdit={() => setEditingPrice(true)} />
            ) : tab === "rules" ? (
              <RuleConfig scenario={scenario} draftRequest={ruleDraft} />
            ) : tab === "parameters" ? (
              <FieldConfig
                scenario={scenario}
                activeGroup={activeParameterGroup}
                onActiveGroupChange={(group) => { setActiveParameterGroup(group); setActiveField(0); }}
                activeField={activeField}
                onActiveFieldChange={setActiveField}
                onAdd={() => setDialog("new-parameter")}
              />
            ) : (
              <TemplateConfig scenario={scenario} onView={() => setDialog("view-template")} />
            )}
          </section>
        )}
      </section>
      {business === "dmpk" && scenario ? (
        <DmpkRuleAssistant
          scenario={scenario}
          activeTab={tab}
          onTabChange={setTab}
          onRuleDraft={(draft) => { setRuleDraft(draft); setTab("rules"); }}
        />
      ) : null}
      {editingPrice ? <PriceDrawer onClose={() => setEditingPrice(false)} /> : null}
      {dialog ? <ManagementDialog dialog={dialog} onClose={() => setDialog(null)} /> : null}
    </main>
  );
}

export default QuotationManagement;
