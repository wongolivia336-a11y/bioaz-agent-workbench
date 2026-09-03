"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ParamDraft, ParamField, ParamGroup } from "./types";

/**
 * Composer 里的已选参数托盘。
 *
 * 收起态：chips 只占**一行**，多出来的直接裁掉，右侧一道渐隐提示还有更多，
 * 旁边一颗按钮报总数。这里刻意用 CSS 裁剪而不是算「能放几个」——chip 宽度
 * 差得远（「分子类型：小分子」vs「组数：2」），任何写死的个数都会在某个组合
 * 下露馅，而按钮上写总数就不需要知道露出了几个。
 *
 * 展开态：composer 向上膨胀，chips 按参数组分栏换行铺开。分组不是装饰——
 * 二十几个 chip 平铺就是一堵墙，按组分开才扫得动。
 *
 * 待发状态只在这里显示。
 * ----------------------------------------------------------------------
 * 右栏台账只显示**已落库**的取值。两边都标一遍「未提交」，人就得自己判断
 * 哪一个是真的；而「选了还没发」这件事天然属于输入框，它就在手指旁边。
 */
export function ComposerChipTray({ tabs, groups, fields, onRemove }: {
  tabs: ParamDraft[];
  groups: ParamGroup[];
  /** 用来把 chip 归到它自己那一组 */
  fields: ParamField[];
  onRemove: (fieldId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // chips 被清空后（发送完一轮）自动回到收起态，否则下次进来是个空的大盒子
  useEffect(() => { if (!tabs.length) setExpanded(false); }, [tabs.length]);
  const groupById = useMemo(() => new Map(fields.map((field) => [field.id, field.group])), [fields]);
  if (!tabs.length) return null;

  const grouped = groups
    .map((group) => ({ group, items: tabs.filter((tab) => groupById.get(tab.fieldId) === group.id) }))
    .filter((entry) => entry.items.length);
  const ungrouped = tabs.filter((tab) => !groupById.has(tab.fieldId));

  const chip = (tab: ParamDraft) => (
    <button type="button" key={tab.fieldId} onClick={() => onRemove(tab.fieldId)} aria-label={`移除 ${tab.label}`} title={`${tab.label}：${tab.value}`}>
      <span>{tab.label}：{tab.value}</span>
      <X size={13} />
    </button>
  );

  const toggle = (
    <button className="composerChipToggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      {/* 报的是总数不是隐藏数——没测量就不知道露出了几个，写「+4」会骗人。
          「4 项 ˅」在任何数量下都成立：已选这么多，点开看全部。 */}
      {expanded ? <>收起<ChevronDown size={12} className="isOpen" /></> : <>{tabs.length} 项<ChevronDown size={12} /></>}
    </button>
  );

  if (!expanded) {
    // 收起态就一行：chips 裁到头渐隐，计数紧跟在断口后面——
    // 内容在哪儿断的，「还有更多」就出现在哪儿。
    return (
      <div className="composerChipTray">
        <div className="draftTabs composerChipStrip">{tabs.map(chip)}</div>
        {toggle}
      </div>
    );
  }

  return (
    <div className="composerChipTray isExpanded">
      <div className="composerChipTrayHead">
        <span className="composerChipCount">已选 {tabs.length} 项参数</span>
        {toggle}
      </div>
      <div className="composerChipGroups">
        {grouped.map((entry) => (
          <section key={entry.group.id}>
            <h5>{entry.group.title}<i>{entry.items.length}</i></h5>
            <div className="draftTabs">{entry.items.map(chip)}</div>
          </section>
        ))}
        {ungrouped.length ? (
          <section>
            <h5>其他<i>{ungrouped.length}</i></h5>
            <div className="draftTabs">{ungrouped.map(chip)}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
