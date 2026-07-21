"use client";

import { Search } from "lucide-react";

const priceRows = [
  ["SD 大鼠", "PK 检测", "¥120", "只"],
  ["Beagle 犬", "PK 检测", "¥850", "只"],
  ["LC-MS/MS 方法开发", "生物分析", "¥6,000", "项"],
  ["血浆样品检测", "PK 检测", "¥180", "样品"],
  ["中文报告", "报告交付", "¥3,000", "份"],
];

export default function PriceConfig({ onEdit }: { onEdit: () => void }) {
  return (
    <>
      <div className="quotationToolbar">
        <label><Search size={15} /><input placeholder="搜索费用项目" /></label>
        <select aria-label="费用分类"><option>全部费用</option><option>动物实验</option><option>生物分析</option><option>报告交付</option></select>
        <span>36 项价格</span>
      </div>
      <div className="quotationTable">
        <div className="quotationTableHead">
          <span>费用项目</span><span>适用场景</span><span>标准单价</span><span>单位</span><span>状态</span>
        </div>
        {priceRows.map((row, index) => (
          <button type="button" key={row[0]} onClick={index < 2 ? onEdit : undefined}>
            <strong>{row[0]}</strong>
            <span>{row[1]}</span>
            <b>{row[2]}</b>
            <span>{row[3]}</span>
            <em><i />已发布</em>
          </button>
        ))}
      </div>
    </>
  );
}
