"use client";

import { TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { describeScope, scenarioLabels, type DetectionScenario, type PriceItem } from "../dmpk/catalog";

export default function PriceDrawer({
  item,
  scenario,
  onSaveMain,
  onSaveException,
  onRemoveException,
  onSwitchToException,
  onClose,
}: {
  item: PriceItem;
  /** null = 改主值（所有适用类型一起变）；否则 = 改这一类的例外 */
  scenario: DetectionScenario | null;
  onSaveMain: (price: string) => void;
  onSaveException: (scenario: DetectionScenario, price: string, note: string) => void;
  onRemoveException: (scenario: DetectionScenario) => void;
  onSwitchToException: (scenario: DetectionScenario) => void;
  onClose: () => void;
}) {
  const existing = scenario ? item.exceptions.find((exception) => exception.scenario === scenario) : null;
  const [price, setPrice] = useState(existing?.price ?? item.price);
  const [note, setNote] = useState(existing?.note ?? "");
  const [pickingScope, setPickingScope] = useState(false);

  /* 只适用于一类的费用项没有「例外」可言——那就是它本来的样子 */
  const canHaveException = item.appliesTo.length > 1;

  return (
    <div className="quotationDrawerBackdrop" role="dialog" aria-modal="true">
      <aside className="quotationDrawer">
        <header>
          <div>
            <span>{scenario ? `${scenarioLabels[scenario]} · 例外` : "标准价格 · 主值"}</span>
            <h2>{scenario ? `仅为 ${scenarioLabels[scenario]} 设置` : `修改「${item.name}」单价`}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </header>

        {scenario ? (
          <p className="quotationDrawerScope isException">
            <span>主值</span>
            <strong>{item.price} / {item.unit}</strong>
            <small>其余属性继续跟随主值，改主值时这里只有单价不受影响。</small>
          </p>
        ) : (
          <p className="quotationDrawerScope">
            <TriangleAlert size={15} />
            <span>此项适用于 <strong>{describeScope(item.appliesTo)}</strong>，修改后同时生效。</span>
          </p>
        )}

        <label>
          {scenario ? "例外单价" : "标准单价"}
          <div><input value={price} onChange={(event) => setPrice(event.target.value)} /><span>/ {item.unit}</span></div>
        </label>
        <label>
          {scenario ? "例外理由" : "调整说明（可选）"}
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={scenario ? "为什么这一类要跟其他类不一样？" : "为什么调整这项价格？"} />
        </label>

        {!scenario && canHaveException ? (
          pickingScope ? (
            <div className="quotationScopePicker">
              <small>为哪一类设置例外？</small>
              <div>
                {item.appliesTo.map((id) => (
                  <button type="button" key={id} onClick={() => onSwitchToException(id)}>{scenarioLabels[id]}</button>
                ))}
              </div>
            </div>
          ) : (
            <button className="quotationDrawerSecondary" type="button" onClick={() => setPickingScope(true)}>
              仅为某一类设为例外
            </button>
          )
        ) : null}

        <footer>
          {scenario && existing ? (
            <button className="quotationDrawerDanger" type="button" onClick={() => onRemoveException(scenario)}>恢复跟随主值</button>
          ) : null}
          <button type="button" onClick={onClose}>取消</button>
          <button
            className="primary"
            type="button"
            onClick={() => (scenario ? onSaveException(scenario, price, note) : onSaveMain(price))}
          >
            保存为草稿
          </button>
        </footer>
      </aside>
    </div>
  );
}
