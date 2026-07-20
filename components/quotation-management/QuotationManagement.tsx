"use client";

import { ArrowLeft, Bot, Check, ChevronRight, ChevronUp, FileSpreadsheet, FlaskConical, GripVertical, LogOut, Orbit, Plus, Search, Send, Settings, Settings2, Sparkles, X } from "lucide-react";
import { useState } from "react";

type DmpkTab = "prices" | "rules" | "parameters" | "templates";
type ManagementDialog = "import" | "new-price" | "parameter-preview" | "new-parameter" | "upload-template" | "view-template" | null;

const tabs: Array<{ id: DmpkTab; label: string }> = [
  { id: "prices", label: "标准价格" },
  { id: "rules", label: "计价规则" },
  { id: "parameters", label: "报价字段" },
  { id: "templates", label: "报价模板" },
];

const priceRows = [
  ["SD 大鼠", "PK 检测", "¥120", "只"],
  ["Beagle 犬", "PK 检测", "¥850", "只"],
  ["LC-MS/MS 方法开发", "生物分析", "¥6,000", "项"],
  ["血浆样品检测", "PK 检测", "¥180", "样品"],
  ["中文报告", "报告交付", "¥3,000", "份"],
];

const parameterGroups = [
  { id: "assay", label: "检测类型", count: 2 },
  { id: "animal", label: "动物实验", count: 4 },
  { id: "analysis", label: "生物分析", count: 5 },
  { id: "delivery", label: "报告与报价", count: 3 },
];

const animalFields = [
  { label: "动物种属", meta: "单选 · SD 大鼠、Beagle 犬、自定义" },
  { label: "每组动物数", meta: "数字选项 · 3、6、10、自定义输入" },
  { label: "组数", meta: "数字选项 · 3、4、6、自定义输入" },
  { label: "试验周期", meta: "数字选项 · 1、2、4 周、自定义输入" },
];

const parameterFields = {
  assay: [
    { label: "检测类型", meta: "单选 · PK、BA Only、TOX" },
    { label: "化合物类别", meta: "单选 · 小分子、大分子、自定义" },
  ],
  animal: animalFields,
  analysis: [
    { label: "分析方法", meta: "单选 · LC-MS/MS、配体结合法、自定义" },
    { label: "样本类型", meta: "多选 · 血浆、血清、组织、自定义" },
    { label: "样本数量", meta: "数字选项 · 60、120、240、自定义输入" },
    { label: "待测物数量", meta: "数字选项 · 1、2、3、自定义输入" },
    { label: "是否需要方法开发", meta: "单选 · 是、否" },
  ],
  delivery: [
    { label: "报告语言", meta: "单选 · 中文、英文、中英双语" },
    { label: "报价币种", meta: "单选 · CNY、USD、自定义" },
    { label: "交付格式", meta: "多选 · Word、Excel、PDF" },
  ],
} satisfies Record<string, Array<{ label: string; meta: string }>>;

export function QuotationManagement({ onBack }: { onBack: () => void }) {
  const [business, setBusiness] = useState<"root" | "dmpk">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("business") === "dmpk" ? "dmpk" : "root");
  const [tab, setTab] = useState<DmpkTab>(() => { const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null; return tabs.some((item) => item.id === value) ? value as DmpkTab : "prices"; });
  const [editingPrice, setEditingPrice] = useState(false);
  const [dialog, setDialog] = useState<ManagementDialog>(null);
  const [activeField, setActiveField] = useState(0);
  const [activeParameterGroup, setActiveParameterGroup] = useState("animal");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantText, setAssistantText] = useState("");
  const [assistantProposal, setAssistantProposal] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<string | null>(null);

  return <main className="quotationManagementShell">
    <aside className="quotationManagementSidebar">
      <div className="quotationManagementBrand"><img src="/logo/bioaz-logo.svg" alt="" /><strong>BioAZ</strong></div>
      <button className="quotationBackButton" type="button" onClick={onBack}><ArrowLeft size={17} />返回工作台</button>
      <span className="quotationSidebarLabel">报价管理</span>
      <button className="quotationSidebarItem active" type="button" onClick={() => setBusiness("root")}><Settings2 size={17} />报价规则</button>
      <div className={`quotationAdmin ${adminMenuOpen ? "menuOpen" : ""}`}><button type="button" onClick={() => setAdminMenuOpen((value) => !value)} aria-expanded={adminMenuOpen}><span className="avatar">A</span><span><strong>Admin</strong><small>admin@example.com</small></span><ChevronUp size={15} /></button>{adminMenuOpen ? <div className="quotationAdminMenu"><div><span className="avatar">A</span><span><strong>Admin</strong><small>admin@example.com</small></span></div><button type="button"><Settings size={15} />账户设置</button><button type="button"><LogOut size={15} />退出登录</button></div> : null}</div>
    </aside>
    <section className="quotationManagementMain">
      <header className="quotationManagementTopbar"><strong>{business === "root" ? "报价规则" : "报价规则 / DMPK 报价"}</strong><span>{business === "root" ? "管理员模式" : "草稿 2"}</span></header>
      {business === "root" ? <BusinessPicker onOpenDmpk={() => setBusiness("dmpk")} /> : <section className="quotationManagementPage">
        <header className="quotationPageHeader"><div><span>DMPK QUOTATION</span><h1>{tabs.find((item) => item.id === tab)?.label}</h1><p>{tab === "prices" ? "当前发布版本 v1.0.13" : tab === "rules" ? "管理不同检测条件下，费用如何计算。" : tab === "parameters" ? "配置报价任务需要确认的信息与常用选项。" : "管理客户最终收到的 Excel 与 Word 版式。"}</p></div>{tab === "prices" ? <div><button type="button" onClick={() => setDialog("import")}>导入 Excel</button><button className="primary" type="button" onClick={() => setDialog("new-price")}>新增价格</button></div> : tab === "parameters" ? <button className="primary" type="button" onClick={() => setDialog("parameter-preview")}>预览前台表单</button> : tab === "templates" ? <button className="primary" type="button" onClick={() => setDialog("upload-template")}>上传新模板</button> : null}</header>
        <nav className="quotationTabs">{tabs.map((item) => <button className={tab === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
        {tab === "prices" ? <PricesView onEdit={() => setEditingPrice(true)} /> : tab === "rules" ? <RulesView draftRequest={ruleDraft} /> : tab === "parameters" ? <ParametersView activeGroup={activeParameterGroup} onActiveGroupChange={(group) => { setActiveParameterGroup(group); setActiveField(0); }} activeField={activeField} onActiveFieldChange={setActiveField} onAdd={() => setDialog("new-parameter")} /> : <TemplatesView onView={() => setDialog("view-template")} />}
      </section>}
    </section>
    {business === "dmpk" ? <div className={`quotationRuleAssistant ${assistantOpen ? "isOpen" : ""}`}>{assistantOpen ? <section><header><div><span><Bot size={15} /></span><strong>DMPK 报价同事</strong></div><button type="button" onClick={() => { setAssistantOpen(false); setAssistantProposal(null); }} aria-label="关闭 DMPK 报价同事"><X size={15} /></button></header>{assistantProposal ? <div className="quotationChangeProposal"><span className="quotationAiTag"><Sparkles size={13} />已识别修改对象</span><h3>这次将修改计价规则</h3><dl><div><dt>修改</dt><dd>计价规则</dd></div><div><dt>不会修改</dt><dd>报价字段、报价模板</dd></div><div><dt>影响范围</dt><dd>未来新建的 PK 报价</dd></div></dl><footer><button type="button" onClick={() => setAssistantProposal(null)}>返回修改</button><button className="primary" type="button" onClick={() => { setRuleDraft(assistantProposal); setTab("rules"); setAssistantOpen(false); setAssistantProposal(null); }}>确认并进入规则编辑</button></footer></div> : <><p>描述你想调整的字段、计价方式或报价模板。</p><div className="quotationAssistantComposer"><textarea autoFocus rows={3} value={assistantText} onChange={(event) => setAssistantText(event.target.value)} placeholder="例如：以后 PK 样品少于 40 个都按 40 个收费" /><button type="button" disabled={!assistantText.trim()} onClick={() => setAssistantProposal(assistantText.trim())} aria-label="发送"><Send size={16} /></button></div></>}</section> : <button type="button" onClick={() => setAssistantOpen(true)}><Sparkles size={15} />问 DMPK 报价同事</button>}</div> : null}
    {editingPrice ? <PriceDrawer onClose={() => setEditingPrice(false)} /> : null}
    {dialog ? <ManagementDialogView dialog={dialog} onClose={() => setDialog(null)} /> : null}
  </main>;
}

function BusinessPicker({ onOpenDmpk }: { onOpenDmpk: () => void }) {
  return <section className="quotationManagementPage"><header className="quotationPageHeader"><div><span>QUOTATION RULES</span><h1>选择报价业务</h1><p>维护标准价格、特殊规则、报价参数与交付模板。</p></div></header><div className="quotationBusinessGrid"><button type="button" onClick={onOpenDmpk}><span className="quotationBusinessIcon"><FlaskConical size={21} /></span><strong>DMPK 报价</strong><small>PK、BA Only 与 TOX 报价规则</small><footer><em>已发布</em><span>进入<ChevronRight size={15} /></span></footer></button><button className="disabled" type="button" disabled><span className="quotationBusinessIcon"><Orbit size={21} /></span><strong>肿瘤报价</strong><small>肿瘤药效研究的报价规则</small><footer><em>即将接入</em><span>暂不可用</span></footer></button></div></section>;
}

function PricesView({ onEdit }: { onEdit: () => void }) {
  return <><div className="quotationToolbar"><label><Search size={15} /><input placeholder="搜索费用项目" /></label><select aria-label="费用分类"><option>全部费用</option><option>动物实验</option><option>生物分析</option><option>报告交付</option></select><span>36 项价格</span></div><div className="quotationTable"><div className="quotationTableHead"><span>费用项目</span><span>适用场景</span><span>标准单价</span><span>单位</span><span>状态</span></div>{priceRows.map((row, index) => <button type="button" key={row[0]} onClick={index < 2 ? onEdit : undefined}><strong>{row[0]}</strong><span>{row[1]}</span><b>{row[2]}</b><span>{row[3]}</span><em><i />已发布</em></button>)}</div></>;
}

function RulesView({ draftRequest }: { draftRequest?: string | null }) {
  const incomingDraft = draftRequest || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("draft") : null);
  const [prompt, setPrompt] = useState(() => incomingDraft || "SD 大鼠超过 30 只时，动物使用费按 85 折计算");
  const [generated, setGenerated] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [extraCondition, setExtraCondition] = useState(false);
  const [extraAdjustment, setExtraAdjustment] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [inlineEditor, setInlineEditor] = useState<"condition" | "adjustment" | null>(null);
  const [inlineRequest, setInlineRequest] = useState("");
  const openInlineEditor = (kind: "condition" | "adjustment") => {
    setInlineEditor(kind);
    setInlineRequest(kind === "condition" ? "并且试验周期不超过 4 周" : "同时将报告费设为 2,500 元");
  };
  const addInlineRule = () => {
    if (inlineEditor === "condition") setExtraCondition(true);
    if (inlineEditor === "adjustment") setExtraAdjustment(true);
    setShowTrial(false);
    setSaved(false);
    setPublished(false);
    setInlineEditor(null);
  };
  const markRuleChanged = () => { setShowTrial(false); setSaved(false); setPublished(false); };
  if (incomingDraft) return <IncomingRuleDraft request={incomingDraft} />;
  return <><section className="quotationRulePrompt"><textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); setGenerated(false); setShowTrial(false); setSaved(false); setPublished(false); }} aria-label="描述特殊报价规则" placeholder="例如：SD 大鼠超过 30 只时，动物使用费按 85 折计算" /><footer><button className="primary" type="button" disabled={!prompt.trim()} onClick={() => { setGenerated(true); setShowTrial(false); }}><Sparkles size={15} />整理为规则</button></footer></section>{generated ? <div className="quotationRuleGrid"><article className="quotationRuleCard"><header className="quotationRuleDraftHeader"><span className="quotationAiTag"><Bot size={13} />{published ? "已发布" : saved ? "草稿已保存" : "规则草稿 · 尚未生效"}</span><small>{published ? "用于后续新报价" : saved ? "可继续编辑" : "修改后请保存并验证"}</small></header><h2>SD 大鼠批量折扣</h2><RuleSentence prefix="适用于" values={["PK 检测"]} onChange={markRuleChanged} /><RuleSentence prefix="当" values={["动物种属", "等于", "SD 大鼠"]} onChange={markRuleChanged} /><RuleSentence prefix="并且" values={["动物数量", "大于", "30", "只"]} onChange={markRuleChanged} />{extraCondition ? <RuleSentence prefix="并且" values={["试验周期", "小于等于", "4", "周"]} onChange={markRuleChanged} /> : null}<RuleSentence prefix="调整为" values={["动物使用费", "乘以", "85%"]} onChange={markRuleChanged} />{extraAdjustment ? <RuleSentence prefix="同时" values={["报告费", "设为", "2500", "元"]} onChange={markRuleChanged} /> : null}<div className="quotationRuleAddArea"><div className="quotationRuleAddActions"><button type="button" onClick={() => openInlineEditor("condition")}><Plus size={14} />添加条件</button><button type="button" onClick={() => openInlineEditor("adjustment")}><Plus size={14} />添加费用调整</button></div>{inlineEditor ? <section className="quotationInlineRuleEditor"><header><div><Sparkles size={14} /><strong>{inlineEditor === "condition" ? "新增触发条件" : "新增费用调整"}</strong></div><button type="button" onClick={() => setInlineEditor(null)} aria-label="关闭"><X size={14} /></button></header><textarea autoFocus rows={2} value={inlineRequest} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setInlineRequest(event.target.value)} /><footer><small>AI 会整理为可继续编辑的规则字段</small><button className="primary" type="button" disabled={!inlineRequest.trim()} onClick={addInlineRule}>整理并添加</button></footer></section> : null}</div><footer><span className="quotationRuleSaveHint">{published ? "规则已生效" : saved ? "草稿已保存，尚未生效" : showTrial ? "验证通过，尚未保存" : "修改尚未保存"}</span><div><button type="button" onClick={() => setSaved(true)}>保存草稿</button><button type="button" onClick={() => setShowTrial(true)}>验证计算</button><button className="primary" type="button" disabled={!showTrial} onClick={() => { setSaved(true); setPublished(true); }}>发布规则</button></div></footer></article>{showTrial ? <aside className="quotationTrial"><h2>验证结果</h2><small>验证参数：PK · SD 大鼠 · 36 只</small><strong className="quotationTrialStatus"><Check size={14} />规则已触发</strong><dl><div><dt>标准动物费</dt><dd>¥4,320</dd></div><div><dt>规则调整</dt><dd>− ¥648</dd></div>{extraAdjustment ? <div><dt>报告费</dt><dd>¥2,500</dd></div> : null}<div><dt>调整后动物费</dt><dd>¥3,672</dd></div></dl></aside> : null}</div> : <div className="quotationRuleEmpty"><Sparkles size={18} /><strong>描述一条例外计价方式</strong><span>AI 会整理成可编辑的规则草稿。</span></div>}</>;
}

function IncomingRuleDraft({ request }: { request: string }) {
  const match = request.match(/样品.*?少于\s*(\d+)\s*个?.*?按\s*(\d+)\s*个?.*?收费/i);
  const minimum = match?.[2] ?? "40";
  const [showTrial, setShowTrial] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const markChanged = () => { setShowTrial(false); setSaved(false); setPublished(false); };
  return <>
    <section className="quotationRulePrompt quotationIncomingPrompt"><div><span className="quotationAiTag"><Bot size={13} />来自前台对话</span><small>请检查 AI 整理结果，再验证并发布。</small></div><textarea value={request} readOnly aria-label="前台提交的规则需求" /></section>
    <div className="quotationRuleGrid"><article className="quotationRuleCard"><header className="quotationRuleDraftHeader"><span className="quotationAiTag"><Bot size={13} />{published ? "已发布" : saved ? "草稿已保存" : "规则草稿 · 尚未生效"}</span><small>{published ? "用于后续新报价" : "可点击字段手动修改"}</small></header><h2>PK 样品最低计费数量</h2><RuleSentence prefix="适用于" values={["PK 检测"]} onChange={markChanged} /><RuleSentence prefix="当" values={["样品数量", "少于", minimum, "个"]} onChange={markChanged} /><RuleSentence prefix="计费为" values={["样品数量", minimum, "个"]} onChange={markChanged} /><footer><span className="quotationRuleSaveHint">{published ? "规则已生效" : saved ? "草稿已保存，尚未生效" : showTrial ? "验证通过，尚未发布" : "规则尚未验证"}</span><div><button type="button" onClick={() => setSaved(true)}>保存草稿</button><button type="button" onClick={() => setShowTrial(true)}>验证计算</button><button className="primary" type="button" disabled={!showTrial} onClick={() => { setSaved(true); setPublished(true); }}>发布规则</button></div></footer></article>
    {showTrial ? <aside className="quotationTrial"><h2>验证结果</h2><small>验证参数：PK · 32 个样品</small><strong className="quotationTrialStatus"><Check size={14} />规则已触发</strong><dl><div><dt>实际样品数</dt><dd>32 个</dd></div><div><dt>计费样品数</dt><dd>{minimum} 个</dd></div><div><dt>规则结果</dt><dd>按 {minimum} 个收费</dd></div></dl></aside> : null}</div>
  </>;
}

function RuleSentence({ prefix, values, onChange }: { prefix: string; values: string[]; onChange: () => void }) { return <div className="quotationRuleSentence"><span>{prefix}</span><div>{values.map((value, index) => <EditableRuleToken initialValue={value} onChange={onChange} key={`${value}-${index}`} />)}</div></div>; }

function EditableRuleToken({ initialValue, onChange }: { initialValue: string; onChange: () => void }) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  return editing ? <input className="quotationRuleTokenInput" autoFocus value={value} onChange={(event) => { setValue(event.target.value); onChange(); }} onBlur={() => setEditing(false)} onKeyDown={(event) => { if (event.key === "Enter") setEditing(false); }} aria-label={`修改${initialValue}`} /> : <button type="button" title="点击修改" aria-label={`修改${value}`} onClick={() => setEditing(true)}>{value}<span className="quotationRuleTokenEdit">⌄</span></button>;
}

function ParametersView({ activeGroup, onActiveGroupChange, activeField, onActiveFieldChange, onAdd }: { activeGroup: string; onActiveGroupChange: (group: string) => void; activeField: number; onActiveFieldChange: (index: number) => void; onAdd: () => void }) {
  const group = parameterGroups.find((item) => item.id === activeGroup) ?? parameterGroups[0];
  const fields = parameterFields[activeGroup as keyof typeof parameterFields] ?? parameterFields.assay;
  const selectedField = fields[activeField] ?? fields[0];
  const isNumeric = selectedField.meta.includes("数字选项");
  const options = isNumeric ? ["3", "6", "10", "自定义输入"] : selectedField.meta.split("·")[1]?.split("、").map((item) => item.trim()) ?? ["自定义"];
  return <div className="quotationParameterBuilder"><aside><h2>参数分组</h2>{parameterGroups.map((item) => <button className={item.id === activeGroup ? "active" : ""} type="button" key={item.id} onClick={() => onActiveGroupChange(item.id)}><span>{item.label}</span><small>{item.count}</small></button>)}<button className="add" type="button"><Plus size={14} />添加分组</button></aside><section><h2>{group.label}</h2><p>这里的顺序会同步到报价任务右侧参数面板。</p>{fields.map((field, index) => <button className={activeField === index ? "active" : ""} type="button" key={field.label} onClick={() => onActiveFieldChange(index)}><GripVertical size={15} /><span><strong>{field.label}</strong><small>{field.meta}</small></span><em>必填</em></button>)}<footer><button type="button" onClick={onAdd}><Plus size={14} />添加参数</button><button className="primary" type="button">保存为草稿</button></footer></section><aside className="quotationFieldSettings"><h2>{selectedField.label}</h2><label>参数名称<input defaultValue={selectedField.label} key={`${activeGroup}-${selectedField.label}`} /></label><label>用户选择方式<select defaultValue={isNumeric ? "数字选项" : selectedField.meta.split(" · ")[0]}><option>单选</option><option>多选</option><option>数字选项</option><option>文本输入</option></select></label><label>常用选项<div className="quotationOptionList">{options.map((item) => <span key={item}>{item}<X size={12} /></span>)}</div></label><ToggleRow label="设为必填" /><ToggleRow label="允许自定义输入" /></aside></div>;
}

function ToggleRow({ label }: { label: string }) { return <div className="quotationToggleRow"><span>{label}</span><i><b /></i></div>; }

function TemplatesView({ onView }: { onView: () => void }) {
  const templates = [
    { id: "pk", title: "PK 标准报价单", version: "v8", date: "2026-07-15", count: 8 },
    { id: "ba", title: "BA Only 报价单", version: "v4", date: "2026-07-15", count: 4 },
    { id: "tox", title: "TOX 标准报价单", version: "v2", date: "2026-07-10", count: 2 },
  ];
  const [activeTemplate, setActiveTemplate] = useState("pk");
  const selected = templates.find((item) => item.id === activeTemplate) ?? templates[0];
  return <div className="quotationTemplateWorkspace"><div className="quotationTemplateScenarioGrid">{templates.map((template) => <article className={template.id === activeTemplate ? "active" : ""} key={template.id} onClick={() => setActiveTemplate(template.id)}><header><span><FileSpreadsheet size={18} /></span><em><Check size={12} />已发布</em></header><strong>{template.title}</strong><small>当前版本 {template.version} · Excel 与 Word</small><footer><button type="button" onClick={(event) => { event.stopPropagation(); setActiveTemplate(template.id); onView(); }}>预览</button><span>{template.count} 个版本 <ChevronRight size={14} /></span></footer></article>)}</div><section className="quotationTemplateHistory"><header><div><h2>{selected.title} · 版本记录</h2><small>当前与历史版本</small></div><span>共 {selected.count} 个版本</span></header>{[[selected.version, "当前使用", selected.date], [selected.id === "pk" ? "v7" : selected.id === "ba" ? "v3" : "v1", "历史版本", "2026-06-20"], [selected.id === "pk" ? "v6" : "—", "历史版本", "2026-05-08"]].filter((item) => item[0] !== "—").map(([version, status, date]) => <button type="button" key={version} onClick={onView}><strong>{version}</strong><span>{status}</span><small>{date}</small><ChevronRight size={15} /></button>)}</section></div>;
}

function ManagementDialogView({ dialog, onClose }: { dialog: Exclude<ManagementDialog, null>; onClose: () => void }) {
  const content = {
    import: { title: "导入标准价格", body: <><label className="managementDialogUpload"><FileSpreadsheet size={23} /><strong>选择 Excel 价格表</strong><small>系统会先识别价格变化，不会直接发布。</small><input type="file" accept=".xlsx,.xls" /></label><div className="managementDialogSteps"><span className="active">1 上传文件</span><span>2 检查变化</span><span>3 保存草稿</span></div></> },
    "new-price": { title: "新增标准价格", body: <div className="managementDialogForm"><label>费用项目<input placeholder="例如：SD 大鼠" /></label><label>适用场景<select><option>PK 检测</option><option>BA Only 检测</option><option>TOX 检测</option></select></label><div><label>标准单价<input type="number" placeholder="0" /></label><label>计价单位<select><option>只</option><option>项</option><option>样品</option><option>份</option></select></label></div></div> },
    "parameter-preview": { title: "前台参数预览", body: <div className="managementFormPreview"><span>动物实验</span>{animalFields.map((field) => <section key={field.label}><strong>{field.label}</strong><div>{(field.label === "动物种属" ? ["SD 大鼠", "Beagle 犬", "自定义"] : ["3", "6", "10", "自定义"]).map((item) => <button type="button" key={item}>{item}</button>)}</div></section>)}</div> },
    "new-parameter": { title: "添加报价参数", body: <div className="managementDialogForm"><label>参数名称<input placeholder="例如：给药次数" /></label><label>用户选择方式<select><option>数字选项</option><option>单选</option><option>多选</option><option>文本输入</option></select></label><label>常用选项<input placeholder="例如：1、2、3" /></label><p>数字选项会自动提供“自定义输入”。</p></div> },
    "upload-template": { title: "上传报价模板", body: <><label className="managementDialogUpload"><FileSpreadsheet size={23} /><strong>选择 Excel 或 Word 模板</strong><small>上传后先进行版式预览和试生成。</small><input type="file" accept=".xlsx,.xls,.docx" /></label><div className="managementDialogForm"><label>适用业务<select><option>PK 检测</option><option>BA Only 检测</option><option>TOX 检测</option></select></label></div></> },
    "view-template": { title: "PK 标准报价单", body: <div className="managementTemplatePreview"><div><FileSpreadsheet size={28} /><span><strong>PK标准报价模板-v8.xlsx</strong><small>当前发布版本 · 2026-07-15</small></span></div><dl><div><dt>适用场景</dt><dd>PK 检测</dd></div><div><dt>报价语言</dt><dd>中文 · 英文自动生成</dd></div><div><dt>最近试生成</dt><dd>金额一致</dd></div></dl><button type="button">试生成一份报价单</button></div> },
  }[dialog];
  return <div className="managementDialogBackdrop" role="dialog" aria-modal="true"><section className="managementDialog"><header><h2>{content.title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header>{content.body}<footer><button type="button" onClick={onClose}>取消</button><button className="primary" type="button" onClick={onClose}>{dialog === "parameter-preview" || dialog === "view-template" ? "完成" : "保存为草稿"}</button></footer></section></div>;
}

function PriceDrawer({ onClose }: { onClose: () => void }) {
  return <div className="quotationDrawerBackdrop" role="dialog" aria-modal="true"><aside className="quotationDrawer"><header><div><span>标准价格</span><h2>修改 SD 大鼠单价</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><label>适用场景<select><option>PK 检测</option></select></label><label>标准单价<div><input defaultValue="120" /><span>元 / 只</span></div></label><label>调整说明（可选）<textarea rows={3} placeholder="为什么调整这项价格？" /></label><p><span>影响范围</span><strong>未来新建的 DMPK 报价</strong></p><footer><button type="button" onClick={onClose}>取消</button><button className="primary" type="button" onClick={onClose}>保存为草稿</button></footer></aside></div>;
}
