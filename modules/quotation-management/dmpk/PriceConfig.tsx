"use client";

import { Search } from "lucide-react";
import type { DetectionScenario } from "../components/ScenarioSelector";

interface PriceItem {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  status: "published" | "draft";
}

const pkPrices: PriceItem[] = [
  { id: "p1", name: "SD 大鼠", category: "动物实验", price: "¥120", unit: "只", status: "published" },
  { id: "p2", name: "Beagle 犬", category: "动物实验", price: "¥850", unit: "只", status: "published" },
  { id: "p3", name: "仓鼠", category: "动物实验", price: "¥95", unit: "只", status: "published" },
  { id: "p4", name: "动物饲养", category: "动物实验", price: "¥15", unit: "只/天", status: "published" },
  { id: "p5", name: "血浆样品检测", category: "生物分析", price: "¥180", unit: "样品", status: "published" },
  { id: "p6", name: "LC-MS/MS 方法开发", category: "生物分析", price: "¥6,000", unit: "项", status: "published" },
  { id: "p7", name: "配体结合法", category: "生物分析", price: "¥8,000", unit: "项", status: "published" },
  { id: "p8", name: "中文报告", category: "报告交付", price: "¥3,000", unit: "份", status: "published" },
  { id: "p9", name: "英文报告", category: "报告交付", price: "¥4,500", unit: "份", status: "published" },
];

const baPrices: PriceItem[] = [
  { id: "b1", name: "血浆样品检测", category: "生物分析", price: "¥180", unit: "样品", status: "published" },
  { id: "b2", name: "LC-MS/MS 方法开发", category: "生物分析", price: "¥6,000", unit: "项", status: "published" },
  { id: "b3", name: "配体结合法", category: "生物分析", price: "¥8,000", unit: "项", status: "published" },
  { id: "b4", name: "中文报告", category: "报告交付", price: "¥3,000", unit: "份", status: "published" },
  { id: "b5", name: "英文报告", category: "报告交付", price: "¥4,500", unit: "份", status: "published" },
  { id: "b6", name: "BA 专用分析方法", category: "生物分析", price: "¥7,500", unit: "项", status: "draft" },
];

const toxPrices: PriceItem[] = [
  { id: "t1", name: "SD 大鼠", category: "动物实验", price: "¥120", unit: "只", status: "published" },
  { id: "t2", name: "Beagle 犬", category: "动物实验", price: "¥850", unit: "只", status: "published" },
  { id: "t3", name: "仓鼠", category: "动物实验", price: "¥95", unit: "只", status: "published" },
  { id: "t4", name: "动物饲养", category: "动物实验", price: "¥15", unit: "只/天", status: "published" },
  { id: "t5", name: "血浆样品检测", category: "生物分析", price: "¥180", unit: "样品", status: "published" },
  { id: "t6", name: "LC-MS/MS 方法开发", category: "生物分析", price: "¥6,000", unit: "项", status: "published" },
  { id: "t7", name: "毒性终点分析", category: "生物分析", price: "¥12,000", unit: "项", status: "draft" },
  { id: "t8", name: "中文报告", category: "报告交付", price: "¥3,000", unit: "份", status: "published" },
  { id: "t9", name: "英文报告", category: "报告交付", price: "¥4,500", unit: "份", status: "published" },
];

const scenarioPrices: Record<DetectionScenario, PriceItem[]> = {
  pk: pkPrices,
  "ba-only": baPrices,
  tox: toxPrices,
};

export default function PriceConfig({ scenario, onEdit }: { scenario: DetectionScenario; onEdit: () => void }) {
  const prices = scenarioPrices[scenario] ?? pkPrices;

  return (
    <>
      <div className="quotationToolbar">
        <label><Search size={15} /><input placeholder="搜索费用项目" /></label>
        <select aria-label="费用分类">
          <option>全部费用</option>
          <option>动物实验</option>
          <option>生物分析</option>
          <option>报告交付</option>
        </select>
        <span>{prices.length} 项价格</span>
      </div>
      <div className="quotationTable">
        <div className="quotationTableHead">
          <span>费用项目</span>
          <span>分类</span>
          <span>标准单价</span>
          <span>单位</span>
          <span>状态</span>
        </div>
        {prices.map((item, index) => (
          <button type="button" key={item.id} onClick={index < 2 ? onEdit : undefined}>
            <strong>{item.name}</strong>
            <span>{item.category}</span>
            <b>{item.price}</b>
            <span>{item.unit}</span>
            <em><i />{item.status === "published" ? "已发布" : "草稿"}</em>
          </button>
        ))}
      </div>
    </>
  );
}
