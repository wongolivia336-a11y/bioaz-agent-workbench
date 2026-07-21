"use client";

import { X } from "lucide-react";

export default function PriceDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="quotationDrawerBackdrop" role="dialog" aria-modal="true">
      <aside className="quotationDrawer">
        <header>
          <div>
            <span>标准价格</span>
            <h2>修改 SD 大鼠单价</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </header>
        <label>适用场景<select><option>PK 检测</option></select></label>
        <label>
          标准单价
          <div><input defaultValue="120" /><span>元 / 只</span></div>
        </label>
        <label>调整说明（可选）<textarea rows={3} placeholder="为什么调整这项价格？" /></label>
        <p><span>影响范围</span><strong>未来新建的 DMPK 报价</strong></p>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" type="button" onClick={onClose}>保存为草稿</button>
        </footer>
      </aside>
    </div>
  );
}
