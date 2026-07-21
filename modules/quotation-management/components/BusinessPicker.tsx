"use client";

import { ChevronRight, FlaskConical, Orbit } from "lucide-react";

export default function BusinessPicker({ onOpenDmpk }: { onOpenDmpk: () => void }) {
  return (
    <section className="quotationManagementPage">
      <header className="quotationPageHeader">
        <div>
          <span>QUOTATION RULES</span>
          <h1>选择报价业务</h1>
          <p>维护标准价格、特殊规则、报价参数与交付模板。</p>
        </div>
      </header>
      <div className="quotationBusinessGrid">
        <button type="button" onClick={onOpenDmpk}>
          <span className="quotationBusinessIcon"><FlaskConical size={21} /></span>
          <strong>DMPK 报价</strong>
          <small>PK、BA Only 与 TOX 报价规则</small>
          <footer><em>已发布</em><span>进入<ChevronRight size={15} /></span></footer>
        </button>
        <button className="disabled" type="button" disabled>
          <span className="quotationBusinessIcon"><Orbit size={21} /></span>
          <strong>肿瘤报价</strong>
          <small>肿瘤药效研究的报价规则</small>
          <footer><em>即将接入</em><span>暂不可用</span></footer>
        </button>
      </div>
    </section>
  );
}
