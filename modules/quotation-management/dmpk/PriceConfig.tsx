"use client";

import { CornerDownRight, ListFilter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Menu, MenuGroup, MenuItem, StatusChip } from "../../../components/ui";
import PriceDrawer from "../components/PriceDrawer";
import {
  matchesScenario,
  priceCatalog,
  priceCategories,
  scenarioShortLabels,
  type DetectionScenario,
  type PriceItem,
} from "./catalog";

type ScenarioFilter = DetectionScenario | "all";

/** 打开抽屉时要说清楚改的是主值还是某一类的例外——这两件事后果完全不同 */
type EditTarget = { item: PriceItem; scenario: DetectionScenario | null };

export default function PriceConfig({ filter }: { filter: ScenarioFilter }) {
  const [items, setItems] = useState<PriceItem[]>(priceCatalog);
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<EditTarget | null>(null);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesScenario(item.appliesTo, filter) &&
          (category === "all" || item.category === category) &&
          (!keyword.trim() || item.name.includes(keyword.trim())),
      ),
    [category, filter, items, keyword],
  );

  const exceptionCount = visible.reduce((total, item) => total + item.exceptions.length, 0);

  const saveMainValue = (id: string, price: string) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, price } : item)));
  };

  const saveException = (id: string, scenario: DetectionScenario, price: string, note: string) => {
    setItems((list) =>
      list.map((item) => {
        if (item.id !== id) return item;
        const rest = item.exceptions.filter((exception) => exception.scenario !== scenario);
        return { ...item, exceptions: [...rest, { scenario, price, note: note || undefined }] };
      }),
    );
  };

  const removeException = (id: string, scenario: DetectionScenario) => {
    setItems((list) =>
      list.map((item) =>
        item.id === id ? { ...item, exceptions: item.exceptions.filter((exception) => exception.scenario !== scenario) } : item,
      ),
    );
  };

  return (
    <>
      <div className="quotationToolbar">
        <label>
          <Search size={14} />
          <input placeholder="搜索费用项目" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </label>
        {/* 沿用全站的 Menu，不再放一个原生 select——原生控件不吃字号也不吃圆角，
            跟旁边的搜索框永远差着几个像素高 */}
        <Menu icon={<ListFilter size={16} />} label="费用分类" active={category !== "all"}>
          <MenuGroup label="费用分类">
            <MenuItem active={category === "all"} onSelect={() => setCategory("all")}>全部费用</MenuItem>
            {priceCategories.map((item) => (
              <MenuItem active={category === item} onSelect={() => setCategory(item)} key={item}>{item}</MenuItem>
            ))}
          </MenuGroup>
        </Menu>
        <span>
          {category === "all" ? null : <em>{category} · </em>}
          {visible.length} 项价格
          {exceptionCount ? <em className="quotationScopeCount"> · {exceptionCount} 条例外</em> : null}
        </span>
      </div>
      <div className="quotationTable">
        <div className="quotationTableHead">
          <span>费用项目</span>
          <span>适用于</span>
          <span>标准单价</span>
          <span>单位</span>
          <span>状态</span>
        </div>
        {visible.map((item) => (
          <ItemRows
            key={item.id}
            item={item}
            filter={filter}
            onEditMain={() => setEditing({ item, scenario: null })}
            onEditException={(scenario) => setEditing({ item, scenario })}
          />
        ))}
        {visible.length === 0 ? <p className="quotationTableEmpty">没有符合条件的费用项目。</p> : null}
      </div>
      {editing ? (
        <PriceDrawer
          item={items.find((item) => item.id === editing.item.id) ?? editing.item}
          scenario={editing.scenario}
          onSaveMain={(price) => { saveMainValue(editing.item.id, price); setEditing(null); }}
          onSaveException={(scenario, price, note) => { saveException(editing.item.id, scenario, price, note); setEditing(null); }}
          onRemoveException={(scenario) => { removeException(editing.item.id, scenario); setEditing(null); }}
          onSwitchToException={(scenario) => setEditing({ item: editing.item, scenario })}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function ItemRows({
  item,
  filter,
  onEditMain,
  onEditException,
}: {
  item: PriceItem;
  filter: ScenarioFilter;
  onEditMain: () => void;
  onEditException: (scenario: DetectionScenario) => void;
}) {
  /* 筛到某一类时，只有那一类的例外值得占一行；筛「全部」时全都列出来 */
  const exceptions = item.exceptions.filter((exception) => filter === "all" || exception.scenario === filter);

  return (
    <>
      <button type="button" onClick={onEditMain}>
        <strong>{item.name}</strong>
        <ScopeTags item={item} filter={filter} />
        <b>{item.price}</b>
        <span>{item.unit}</span>
        <StatusChip tone={item.status === "published" ? "success" : "warning"} dot>
          {item.status === "published" ? "已发布" : "草稿"}
        </StatusChip>
      </button>
      {exceptions.map((exception) => (
        <button className="isException" type="button" key={exception.scenario} onClick={() => onEditException(exception.scenario)}>
          <strong>
            <CornerDownRight size={14} />
            {scenarioShortLabels[exception.scenario]} 例外
            {exception.note ? <small>{exception.note}</small> : null}
          </strong>
          <span className="quotationScopeTags">
            <i className="isActive">{scenarioShortLabels[exception.scenario]}</i>
          </span>
          <b>{exception.price}</b>
          <span>{item.unit}</span>
          <StatusChip tone="warning" dot>草稿</StatusChip>
        </button>
      ))}
    </>
  );
}

function ScopeTags({ item, filter }: { item: PriceItem; filter: ScenarioFilter }) {
  return (
    <span className="quotationScopeTags">
      {item.appliesTo.map((scenario) => (
        <i
          className={filter !== "all" && filter === scenario ? "isActive" : ""}
          key={scenario}
          /* 已经有例外的那一类单独标出来，否则主值那一行会显得「我管着它」，其实不管 */
          data-overridden={item.exceptions.some((exception) => exception.scenario === scenario) ? "true" : undefined}
        >
          {scenarioShortLabels[scenario]}
        </i>
      ))}
    </span>
  );
}
