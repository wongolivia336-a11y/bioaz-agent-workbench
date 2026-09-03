"use client";

import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PreviewModal } from "../ui/PreviewModal";
import { ScrollTopButton } from "../ui/ScrollTopButton";
import { ParameterFieldRow } from "./ParameterFieldRow";
import { effectiveValues, type ParamDraft, type ParamField, type ParamGroup } from "./types";

/**
 * 输入框上方那张参数补全卡。
 *
 * 从 `modules/dmpk-quotation/views.tsx` 抽出来的，行为一条没改：
 * 分页 tab、点空白处全屏、填完最后一项自动翻页、全屏里取消分页一次列全。
 * 变的只是「哪些参数、分几组、每项用什么控件」全部从 props 来。
 *
 * 类名一个都没改（`.parameterTaskCard` / `.warningDecision` / `.decisionRow` …）。
 * 这是有意的：这套卡片的样式散在 review.css、globals.css、iteration.css、
 * composer-chips.css 四个全局表里，换一套类名等于重写它们；而共用类名之后，
 * 肿瘤报价什么都不做就跟 DMPK 长一个样——这正是「统一」要的结果。
 */
export function ParameterTaskCard({
  groups,
  fields,
  allFields,
  activeGroup,
  draftTabs,
  mode,
  onSelect,
  eyebrow = "参数补全",
  collectTitle = "请补全报价参数",
  modalTitle = "报价参数",
}: {
  groups: ParamGroup[];
  /** 卡里要列出来的（还缺的那些）。空数组时卡片收起。 */
  fields: ParamField[];
  /** 全部参数——全屏面板要一次列全，依赖判断也要看全量。 */
  allFields: ParamField[];
  activeGroup: string;
  draftTabs: ParamDraft[];
  mode: "collect" | "edit";
  onSelect: (field: ParamField, value: string) => void;
  eyebrow?: string;
  collectTitle?: string;
  modalTitle?: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [page, setPage] = useState(() => Math.max(0, groups.findIndex((group) => group.id === activeGroup)));
  const safePage = Math.min(page, Math.max(0, groups.length - 1));
  const pageGroup = groups[safePage];
  const pageFields = mode === "edit" ? fields : fields.filter((field) => field.group === pageGroup?.id);
  useEffect(() => {
    const activePage = groups.findIndex((group) => group.id === activeGroup);
    if (activePage >= 0) setPage(activePage);
  }, [activeGroup, groups]);

  const values = effectiveValues(allFields, draftTabs);

  const selectValue = (field: ParamField, value: string) => {
    onSelect(field, value);
    /* 自动翻页只对「一次点中」的控件成立。文本框和重复行每敲一个字都会
       走到这里，跟着翻页等于打字打到一半被换走一整页。 */
    const discrete = (field.kind ?? "options") === "options" || field.kind === "select";
    if (!discrete || mode !== "collect" || pageFields.length !== 1 || pageFields[0]?.id !== field.id) return;
    const nextPage = groups.findIndex((group, index) => index > safePage && fields.some((item) => item.id !== field.id && item.group === group.id));
    if (nextPage >= 0) window.requestAnimationFrame(() => setPage(nextPage));
  };

  const row = (field: ParamField, index: number, onChange: (value: string) => void) => (
    <ParameterFieldRow
      key={field.id}
      field={field}
      index={index}
      fields={allFields}
      values={values}
      onChange={onChange}
    />
  );

  const modal = fullscreen ? (
    <ParameterFullscreenModal
      groups={groups}
      allFields={allFields}
      draftTabs={draftTabs}
      values={values}
      renderRow={row}
      onSelect={onSelect}
      onClose={() => setFullscreen(false)}
      eyebrow={eyebrow}
      title={modalTitle}
    />
  ) : null;

  /* 行内卡在没有待填项时收起，但**弹窗开着的时候不能跟着消失**——在全屏里填完
     最后一项，整个面板凭空蒸发会让人以为出错了。让它留到你自己点关闭。 */
  if (!fields.length) return modal;

  return (
    <>
      <section
        className={`warningDecision parameterTaskCard ${mode === "collect" ? "canExpand" : ""}`}
        /* 整张卡的空白处都能展开，不只是那颗图标——参数一多，人会先去点卡片
           本身。选项、分页 tab、上一页这些自己有事做的元素要放行，否则选一个
           值会顺手把弹窗也开了。 */
        onClick={mode === "collect" ? (event) => {
          if ((event.target as HTMLElement).closest("button, input, select, textarea, a, label")) return;
          setFullscreen(true);
        } : undefined}
      >
        <header className="warningDecisionHeader">
          <div>
            <span>{eyebrow}</span>
            <strong>{mode === "edit" ? `修改${fields[0]?.label ?? "参数"}` : collectTitle}</strong>
            {mode === "edit" ? <p>选择新值后发送，即可更新右侧参数。</p> : null}
          </div>
          {/* 计数和入口平排一行，图标在右端。上下堆两行会在卡片右上角叠出
              一块比标题还高的方块，把标题压偏。 */}
          <div className="parameterCardHeadActions">
            <small>还需填写 {fields.length} 项</small>
            {/* 分页是为了在这个高度里放得下，不是因为这些参数该被分批问。
                全屏的价值在于一屏看全，哪项都能先填。 */}
            {mode === "collect" ? <button className="parameterExpandButton" type="button" onClick={() => setFullscreen(true)} aria-label="全屏填写全部参数" title="全屏填写全部参数"><Maximize2 size={15} /></button> : null}
          </div>
        </header>
        {mode === "collect" ? (
          <div className="parameterPages">
            {groups.map((group, index) => (
              <button className={index === safePage ? "active" : ""} type="button" key={group.id} disabled={index > safePage} onClick={() => setPage(index)}>{group.title}</button>
            ))}
          </div>
        ) : null}
        <div className="warningDecisionList">
          {pageFields.length
            ? pageFields.map((field, index) => row(field, index + 1, (value) => selectValue(field, value)))
            : <p className="emptyPageNote">{pageGroup?.title}参数已齐全，可切换下一页继续补全。</p>}
        </div>
        <div className="parameterPager">
          <p className="responsibilityNote">还需填写 {fields.length} 项</p>
          {mode === "collect" && safePage > 0 ? <div><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))}>上一页</button></div> : null}
        </div>
      </section>
      {modal}
    </>
  );
}

/** 全屏参数面板。取消分页，各组一次列全，哪一项都能先填。 */
function ParameterFullscreenModal({ groups, allFields, draftTabs, values, renderRow, onSelect, onClose, eyebrow, title }: {
  groups: ParamGroup[];
  allFields: ParamField[];
  draftTabs: ParamDraft[];
  values: Record<string, string>;
  renderRow: (field: ParamField, index: number, onChange: (value: string) => void) => React.ReactNode;
  onSelect: (field: ParamField, value: string) => void;
  onClose: () => void;
  eyebrow: string;
  title: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMissing = (field: ParamField) => field.required && !values[field.id];
  const remaining = allFields.filter(isMissing).length;

  return (
    <PreviewModal eyebrow={eyebrow} title={title} className="dmpkParamModal" onClose={onClose}>
      <div className="dmpkParamModalBody" ref={scrollRef}>
        {groups.map((group) => {
          const groupFields = allFields.filter((field) => field.group === group.id);
          if (!groupFields.length) return null;
          const groupLeft = groupFields.filter(isMissing).length;
          return (
            <section className="dmpkParamModalGroup" key={group.id}>
              <h3>{group.title}<em>{groupLeft ? `还需 ${groupLeft} 项` : "已齐全"}</em></h3>
              {groupFields.map((field, index) => renderRow(field, index + 1, (value) => onSelect(field, value)))}
            </section>
          );
        })}
      </div>
      <footer className="dmpkParamModalFoot">
        <p>{remaining ? `还需填写 ${remaining} 项` : "参数已齐全，关闭后发送即可"}</p>
        <button className="primaryButton compact" type="button" onClick={onClose}>完成</button>
      </footer>
      <ScrollTopButton targetRef={scrollRef} />
    </PreviewModal>
  );
}
