"use client";

import { CornerDownRight, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Drawer, StatusChip } from "../../../components/ui";
import {
  detectionScenarios,
  priceCategories,
  scenarioLabels,
  scenarioShortLabels,
  type DetectionScenario,
  type PriceItem,
} from "../dmpk/catalog";
import { ScenarioPicker } from "./ScenarioPicker";

export type PriceItemPatch = Partial<Pick<PriceItem, "name" | "category" | "unit" | "price" | "appliesTo">>;

export default function PriceDrawer({
  item,
  scenario,
  onSaveMain,
  onSaveException,
  onRemoveException,
  onOpenException,
  onClose,
}: {
  item: PriceItem;
  /** null = 改主值（所有适用类型一起变）；否则 = 改这一类的例外 */
  scenario: DetectionScenario | null;
  onSaveMain: (patch: PriceItemPatch) => void;
  onSaveException: (scenario: DetectionScenario, price: string, note: string) => void;
  onRemoveException: (scenario: DetectionScenario) => void;
  onOpenException: (scenario: DetectionScenario) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="quotationDrawerBackdrop" onClick={onClose} role="presentation" />
      {scenario ? (
        <ExceptionDrawer
          item={item}
          scenario={scenario}
          onSave={onSaveException}
          onRemove={onRemoveException}
          onClose={onClose}
        />
      ) : (
        <MainDrawer item={item} onSave={onSaveMain} onOpenException={onOpenException} onClose={onClose} />
      )}
    </>
  );
}

function MainDrawer({
  item,
  onSave,
  onOpenException,
  onClose,
}: {
  item: PriceItem;
  onSave: (patch: PriceItemPatch) => void;
  onOpenException: (scenario: DetectionScenario) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(item.price);
  const [appliesTo, setAppliesTo] = useState<DetectionScenario[]>(item.appliesTo);

  // 取消勾选某一类时，它下面挂的例外会跟着失效，得先说清楚再让人按保存
  const droppedExceptions = item.exceptions.filter((exception) => !appliesTo.includes(exception.scenario));

  return (
    <Drawer className="quotationPriceDrawer" eyebrow="标准价格 · 主值" title={`修改「${item.name}」`} onClose={onClose}>
      <section className="kbDetailSection">
        <div className="kbDetailSectionHead"><strong>基本信息</strong></div>
        <label className="quotationField">费用项目<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="quotationField">
          费用分类
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {priceCategories.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="quotationFieldRow">
          <label className="quotationField">
            标准单价
            <div className="quotationFieldSuffix">
              <input value={price} onChange={(event) => setPrice(event.target.value)} />
              <span>/ {unit || "单位"}</span>
            </div>
          </label>
          <label className="quotationField">计价单位<input value={unit} onChange={(event) => setUnit(event.target.value)} /></label>
        </div>
      </section>

      <section className="kbDetailSection">
        <div className="kbDetailSectionHead">
          <strong>适用范围</strong>
          <span className="quotationSectionHint">{appliesTo.length} / {detectionScenarios.length}</span>
        </div>
        <ScenarioPicker
          variant="list"
          value={appliesTo}
          onChange={setAppliesTo}
          renderMeta={(id) =>
            item.exceptions.some((exception) => exception.scenario === id) ? <StatusChip tone="warning">有例外</StatusChip> : null
          }
        />
        <p className="quotationSectionNote">
          在上面改单价，勾选的这 {appliesTo.length} 类会同时生效。要让其中某一类不一样，去下面加一条例外。
        </p>
        {droppedExceptions.length ? (
          <p className="quotationSectionWarning">
            <TriangleAlert size={14} />
            <span>保存后 {droppedExceptions.map((exception) => scenarioShortLabels[exception.scenario]).join("、")} 的例外会一并移除——它已经不在适用范围里了。</span>
          </p>
        ) : null}
      </section>

      <section className="kbDetailSection">
        <div className="kbDetailSectionHead"><strong>例外</strong></div>
        {item.exceptions.length ? (
          item.exceptions.map((exception) => (
            <button className="quotationExceptionRow" type="button" key={exception.scenario} onClick={() => onOpenException(exception.scenario)}>
              <CornerDownRight size={14} />
              <span>
                <strong>{scenarioShortLabels[exception.scenario]}</strong>
                {exception.note ? <small>{exception.note}</small> : null}
              </span>
              <b>{exception.price}</b>
            </button>
          ))
        ) : (
          <p className="quotationSectionNote">还没有例外，这 {appliesTo.length} 类目前用的是同一个价。</p>
        )}
        <div className="quotationScopePicker">
          <small>为哪一类单独设价？</small>
          <div>
            {appliesTo
              .filter((id) => !item.exceptions.some((exception) => exception.scenario === id))
              .map((id) => (
                <button type="button" key={id} onClick={() => onOpenException(id)}>{scenarioLabels[id]}</button>
              ))}
          </div>
        </div>
      </section>

      <footer className="quotationDrawerFooter">
        <button type="button" onClick={onClose}>取消</button>
        <button className="primary" type="button" onClick={() => onSave({ name, category, unit, price, appliesTo })}>保存为草稿</button>
      </footer>
    </Drawer>
  );
}

function ExceptionDrawer({
  item,
  scenario,
  onSave,
  onRemove,
  onClose,
}: {
  item: PriceItem;
  scenario: DetectionScenario;
  onSave: (scenario: DetectionScenario, price: string, note: string) => void;
  onRemove: (scenario: DetectionScenario) => void;
  onClose: () => void;
}) {
  const existing = item.exceptions.find((exception) => exception.scenario === scenario);
  const [price, setPrice] = useState(existing?.price ?? item.price);
  const [note, setNote] = useState(existing?.note ?? "");

  return (
    <Drawer className="quotationPriceDrawer" eyebrow={`${scenarioLabels[scenario]} · 例外`} title={item.name} onClose={onClose}>
      <section className="kbDetailSection">
        <dl>
          <div><dt>主值</dt><dd>{item.price} / {item.unit}</dd></div>
          <div><dt>适用于</dt><dd>{item.appliesTo.map((id) => scenarioShortLabels[id]).join("、")}</dd></div>
        </dl>
        <p className="quotationSectionNote">只有单价走例外，名称、分类、单位仍然跟随主值。</p>
      </section>

      <section className="kbDetailSection">
        <div className="kbDetailSectionHead"><strong>例外单价</strong></div>
        <div className="quotationField">
          <div className="quotationFieldSuffix">
            <input aria-label={`${scenarioShortLabels[scenario]} 例外单价`} value={price} onChange={(event) => setPrice(event.target.value)} />
            <span>/ {item.unit}</span>
          </div>
        </div>
        <label className="quotationField">
          例外理由
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="为什么这一类要跟其他类不一样？" />
        </label>
      </section>

      <footer className="quotationDrawerFooter">
        {existing ? <button className="quotationDrawerDanger" type="button" onClick={() => onRemove(scenario)}>恢复跟随主值</button> : null}
        <button type="button" onClick={onClose}>取消</button>
        <button className="primary" type="button" onClick={() => onSave(scenario, price, note)}>保存为草稿</button>
      </footer>
    </Drawer>
  );
}
