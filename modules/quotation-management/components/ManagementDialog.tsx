"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useModalDismiss } from "../../../components/ui/useModalDismiss";
import type { DetectionScenario } from "../dmpk/catalog";
import { ScenarioPicker } from "./ScenarioPicker";

type ManagementDialog = "import" | "new-price" | "parameter-preview" | "new-parameter" | "upload-template" | "view-template";

export default function ManagementDialogView({ dialog, onClose }: { dialog: ManagementDialog; onClose: () => void }) {
  /* 适用范围是多选：一个费用项、一份模板本来就可能同时服务几类检测。
     以前这里是单选下拉，等于逼着人为同一件东西建三份——正是这轮在拆的那个问题。 */
  const [priceScope, setPriceScope] = useState<DetectionScenario[]>(["pk"]);
  const [templateScope, setTemplateScope] = useState<DetectionScenario[]>(["pk"]);

  const content: Record<ManagementDialog, { title: string; body: React.ReactNode }> = {
    import: {
      title: "导入标准价格",
      body: (
        <>
          <label className="managementDialogUpload">
            <span>选择 Excel 价格表</span>
            <small>系统会先识别价格变化，不会直接发布。</small>
            <input type="file" accept=".xlsx,.xls" />
          </label>
          <div className="managementDialogSteps">
            <span className="active">1 上传文件</span>
            <span>2 检查变化</span>
            <span>3 保存草稿</span>
          </div>
        </>
      ),
    },
    "new-price": {
      title: "新增标准价格",
      body: (
        <div className="managementDialogForm">
          <label>费用项目<input placeholder="例如：SD 大鼠" /></label>
          <div className="managementDialogField">
            <span>适用范围<em>可多选</em></span>
            <ScenarioPicker value={priceScope} onChange={setPriceScope} />
          </div>
          <div>
            <label>标准单价<input type="number" placeholder="0" /></label>
            <label>计价单位<select><option>只</option><option>项</option><option>样品</option><option>份</option></select></label>
          </div>
        </div>
      ),
    },
    "parameter-preview": {
      title: "前台参数预览",
      body: (
        <div className="managementFormPreview">
          <span>动物实验</span>
          {["动物种属", "每组动物数", "组数", "试验周期"].map((field) => (
            <section key={field}>
              <strong>{field}</strong>
              <div>
                {(field === "动物种属" ? ["SD 大鼠", "Beagle 犬", "自定义"] : ["3", "6", "10", "自定义"]).map((item) => (
                  <button type="button" key={item}>{item}</button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ),
    },
    "new-parameter": {
      title: "添加报价参数",
      body: (
        <div className="managementDialogForm">
          <label>参数名称<input placeholder="例如：给药次数" /></label>
          <label>用户选择方式<select><option>数字选项</option><option>单选</option><option>多选</option><option>文本输入</option></select></label>
          <label>常用选项<input placeholder="例如：1、2、3" /></label>
          <p>数字选项会自动提供"自定义输入"。</p>
        </div>
      ),
    },
    "upload-template": {
      title: "上传报价模板",
      body: (
        <>
          <label className="managementDialogUpload">
            <span>选择 Excel 或 Word 模板</span>
            <small>上传后先进行版式预览和试生成。</small>
            <input type="file" accept=".xlsx,.xls,.docx" />
          </label>
          <div className="managementDialogForm">
            <div className="managementDialogField">
              <span>适用范围<em>可多选</em></span>
              <ScenarioPicker value={templateScope} onChange={setTemplateScope} />
            </div>
          </div>
        </>
      ),
    },
    "view-template": {
      title: "PK 标准报价单",
      body: (
        <div className="managementTemplatePreview">
          <div>
            <span>PK标准报价模板-v8.xlsx</span>
            <small>当前发布版本 · 2026-07-15</small>
          </div>
          <dl>
            <div><dt>适用场景</dt><dd>PK 检测</dd></div>
            <div><dt>报价语言</dt><dd>中文 · 英文自动生成</dd></div>
            <div><dt>最近试生成</dt><dd>金额一致</dd></div>
          </dl>
          <button type="button">试生成一份报价单</button>
        </div>
      ),
    },
  };

  const current = content[dialog];
  const dismiss = useModalDismiss(onClose);
  return (
    <div className="managementDialogBackdrop" role="presentation" {...dismiss}>
      <section className="managementDialog" role="dialog" aria-modal="true" aria-label={current.title}>
        {/* 关闭键用 lucide 的 X，跟 Dialog / Drawer 一致——手打的 × 字号和字重都跟图标对不上 */}
        <header><h2>{current.title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></header>
        {current.body}
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" type="button" onClick={onClose}>
            {dialog === "parameter-preview" || dialog === "view-template" ? "完成" : "保存为草稿"}
          </button>
        </footer>
      </section>
    </div>
  );
}
