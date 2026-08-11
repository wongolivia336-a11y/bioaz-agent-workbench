"use client";

import { ArrowLeft, ChevronRight, ChevronUp, LogOut, Settings, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NavTabs, SegmentedControl } from "../../components/ui";
import BusinessPicker from "./components/BusinessPicker";
import DmpkRuleAssistant from "./components/DmpkRuleAssistant";
import ManagementDialog from "./components/ManagementDialog";
import FieldConfig from "./dmpk/FieldConfig";
import PriceConfig from "./dmpk/PriceConfig";
import RuleConfig from "./dmpk/RuleConfig";
import TemplateConfig from "./dmpk/TemplateConfig";
import { detectionScenarios, type DetectionScenario } from "./dmpk/catalog";

export type DmpkTab = "prices" | "rules" | "parameters" | "templates";
type ManagementDialogType = "import" | "new-price" | "parameter-preview" | "new-parameter" | "upload-template" | "view-template" | null;
type ScenarioFilter = DetectionScenario | "all";

const tabs: Array<{ id: DmpkTab; label: string }> = [
  { id: "prices", label: "标准价格" },
  { id: "rules", label: "计价规则" },
  { id: "parameters", label: "报价字段" },
  { id: "templates", label: "报价模板" },
];

/* 价格和字段是列表，可以「全部罗列」；计价规则是一张画布、报价模板每份只属于一类，
   这两个 tab 上「全部」没有意义，筛选器收敛成必须选一类。 */
const listTabs: DmpkTab[] = ["prices", "parameters"];

const tabDescriptions: Record<DmpkTab, string> = {
  prices: "同一费用项只存一份，检测类型是它的适用范围。",
  rules: "管理不同检测条件下，费用如何计算。",
  parameters: "配置报价任务需要确认的信息与常用选项。",
  templates: "管理客户最终收到的 Excel 与 Word 版式。",
};

export function QuotationManagement({
  onBack,
  initialBusiness,
  initialTab,
  initialDraft,
}: {
  onBack: () => void;
  initialBusiness?: "root" | "dmpk";
  initialTab?: DmpkTab;
  initialDraft?: string | null;
}) {
  const [business, setBusiness] = useState<"root" | "dmpk">(initialBusiness ?? "root");
  const [tab, setTab] = useState<DmpkTab>(initialTab ?? "prices");
  const [scenarioFilter, setScenarioFilter] = useState<ScenarioFilter>("all");
  const [dialog, setDialog] = useState<ManagementDialogType>(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<string | null>(initialDraft ?? null);

  const allowsAll = listTabs.includes(tab);
  /* 画布类 tab 一次只能看一类，落到具体那一类上，不留「全部」这个假状态 */
  useEffect(() => {
    if (!allowsAll && scenarioFilter === "all") setScenarioFilter("pk");
  }, [allowsAll, scenarioFilter]);

  const activeScenario: DetectionScenario = scenarioFilter === "all" ? "pk" : scenarioFilter;
  const currentTab = tabs.find((item) => item.id === tab);
  const scenarioFilterItems: Array<{ id: ScenarioFilter; label: string }> = [
    ...(allowsAll ? [{ id: "all" as ScenarioFilter, label: "全部" }] : []),
    // 用简称，三个「XX 检测」并排会把分段控件撑得比 tab 栏还宽
    ...detectionScenarios.map((scenario) => ({ id: scenario.id as ScenarioFilter, label: scenario.short })),
  ];

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
                <button type="button" onClick={() => setBusiness("root")}>报价规则</button>
                <ChevronRight size={15} />
                <button type="button" onClick={() => setTab("prices")}>DMPK 报价</button>
                <ChevronRight size={15} />
                <strong>{currentTab?.label}</strong>
              </>
            )}
          </div>
          <span className="quotationTopbarStatus">{business === "root" ? "管理员模式" : "草稿 2"}</span>
        </header>

        {business === "root" ? (
          <BusinessPicker onOpenDmpk={() => setBusiness("dmpk")} />
        ) : (
          <section className="quotationManagementPage">
            <header className="quotationPageHeader">
              <div>
                <span>DMPK QUOTATION</span>
                <h1>{currentTab?.label}</h1>
                <p>{tab === "prices" ? `当前发布版本 v1.0.13 · ${tabDescriptions.prices}` : tabDescriptions[tab]}</p>
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

            {/* 检测类型是整页的作用域，所以挂在 tab 栏右侧（NavTabs 的 children 位就是留给它的），
                不另起一行——两条工具栏叠在一起会让人分不清哪个管哪个。
                画布类 tab 上「全部」不是省略成禁用项，而是根本不出现：给一个点不动的选项
                比不给更让人困惑。 */}
            <NavTabs items={tabs} value={tab} onChange={setTab} label="报价后台">
              <SegmentedControl
                className="quotationScopeSegment"
                items={scenarioFilterItems}
                value={scenarioFilter}
                onChange={setScenarioFilter}
                label="按检测类型筛选"
              />
            </NavTabs>

            {tab === "prices" ? (
              <PriceConfig filter={scenarioFilter} />
            ) : tab === "rules" ? (
              <RuleConfig scenario={activeScenario} draftRequest={ruleDraft} />
            ) : tab === "parameters" ? (
              <FieldConfig filter={scenarioFilter} onAdd={() => setDialog("new-parameter")} />
            ) : (
              <TemplateConfig scenario={activeScenario} onView={() => setDialog("view-template")} />
            )}
          </section>
        )}
      </section>

      {business === "dmpk" ? (
        <DmpkRuleAssistant
          scenario={activeScenario}
          activeTab={tab}
          onTabChange={setTab}
          onRuleDraft={(draft) => { setRuleDraft(draft); setTab("rules"); }}
        />
      ) : null}
      {dialog ? <ManagementDialog dialog={dialog} onClose={() => setDialog(null)} /> : null}
    </main>
  );
}

export default QuotationManagement;
