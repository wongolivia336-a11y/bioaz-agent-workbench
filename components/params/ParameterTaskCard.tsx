"use client";

import { ChevronDown, Maximize2 } from "lucide-react";
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
  remainingCount,
  open,
  onOpenChange,
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
  /**
   * 还欠着输入的项数。不传就等于卡里的行数——DMPK 十四项都是一次点完的控件，
   * 两者永远相等。会分叉的是多选和重复行：它们填过之后仍然留在卡上让人接着改，
   * 但已经不算欠着，卡头再报「还需填写 1 项」就是在催一件已经做完的事。
   */
  remainingCount?: number;
  onSelect: (field: ParamField, value: string) => void;
  /**
   * 展开没有。不传就自己管（默认折叠）。
   *
   * **会话最好传。** 卡片在 `stage === "collecting"` 时才渲染，而每发一轮
   * 参数都会经过 thinking——卡就卸载再挂载一次，自己管的话每一轮都被重新
   * 折起来，人得反复点开。展开是「这个人现在想填参数」，那是会话级的事实。
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  eyebrow?: string;
  collectTitle?: string;
  modalTitle?: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  /* 单项修改不折叠：那一张卡是**人点了右栏铅笔之后**出现的，他已经说了要改
     哪一项。再让他点一下才看得见，等于问他「你真的要改吗」。
     折叠只对「系统主动弹出来的那张」成立。 */
  const toggleable = mode === "collect";
  const expanded = toggleable ? (open ?? selfOpen) : true;
  const setExpanded = onOpenChange ?? setSelfOpen;
  const [page, setPage] = useState(() => Math.max(0, groups.findIndex((group) => group.id === activeGroup)));
  const safePage = Math.min(page, Math.max(0, groups.length - 1));
  const pageGroup = groups[safePage];
  const pageFields = mode === "edit" ? fields : fields.filter((field) => field.group === pageGroup?.id);
  useEffect(() => {
    const activePage = groups.findIndex((group) => group.id === activeGroup);
    if (activePage >= 0) setPage(activePage);
  }, [activeGroup, groups]);

  const values = effectiveValues(allFields, draftTabs);
  const remaining = remainingCount ?? fields.length;

  /* 能翻到第几页，由**数据**说了算，不是由「自动翻页把你推到了哪儿」说了算。
     原来写的是 `index > safePage` 就禁用，靠自动翻页往前推。而自动翻页只对
     一次点完的控件成立（多选和重复行不能一填就跳走，见 selectValue），于是
     一页的最后一项是多选或重复行时，下一页永远解不开——卡里没路可走，
     人只能去开全屏，而全屏本来是「想一次看全」时才用的东西。
     现在的判据是：前面每一页都不欠输入了，下一页就开。 */
  /* 只有**必填**项空着才锁后面的页。可选项留空是一种完成状态，不是欠着——
     收集阶段这条差别看不出来（那时卡里本来就只有缺的必填项），
     但人把参数填齐之后再打开表单回头改时，卡里列的是全部字段，
     一个空着的「报告语言」会把它后面所有页都锁死。 */
  const firstPendingPage = groups.findIndex((group) => fields.some((field) => field.group === group.id && field.required && !values[field.id]));
  const maxReachablePage = Math.max(firstPendingPage < 0 ? groups.length - 1 : firstPendingPage, safePage);

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
      <section className={`warningDecision parameterTaskCard ${expanded ? "isExpanded" : "isCollapsed"}`}>
        {/* 卡头就是开关。
            ----------------------------------------------------------------
            整张卡的空白处原来点一下直接开全屏，跳过了「展开」这一级——
            于是这张卡只有两个状态：铺开、和铺开之上再盖一张全屏。
            现在是三级，一级比一级重，每一级都得自己按一下：

              折叠（默认）→ 展开（就地填当前这一组）→ 全屏（一屏看全）

            默认折叠是因为**这张卡不是人要求出现的**——是数字同事说「还缺 N 项」
            时自己弹出来的。默认铺开等于每轮对话都往上顶掉半屏聊天记录，
            而人这时候多半只是想看看它说缺什么。缺几项写在卡头上，
            折叠态就已经把话说完了。 */}
        <header
          className="warningDecisionHeader"
          role={toggleable ? "button" : undefined}
          tabIndex={toggleable ? 0 : undefined}
          aria-expanded={toggleable ? expanded : undefined}
          onClick={toggleable ? (event) => {
            // 计数右边那颗全屏键自己有事做，别顺手把卡折起来
            if ((event.target as HTMLElement).closest("button")) return;
            setExpanded(!expanded);
          } : undefined}
          onKeyDown={toggleable ? (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setExpanded(!expanded);
          } : undefined}
        >
          <div>
            <span>{eyebrow}</span>
            <strong>{mode === "edit" ? `修改${fields[0]?.label ?? "参数"}` : collectTitle}</strong>
            {mode === "edit" ? <p>选择新值后发送，即可更新右侧参数。</p> : null}
          </div>
          {/* 计数和入口平排一行，图标在右端。上下堆两行会在卡片右上角叠出
              一块比标题还高的方块，把标题压偏。 */}
          <div className="parameterCardHeadActions">
            <small>{remaining ? `还需填写 ${remaining} 项` : "可继续调整，或直接发送"}</small>
            {/* 全屏只在展开之后才给。折叠态放一颗「一屏看全」，是让人从
                一个什么都没看见的状态直接跳到最重的那一级——中间那级
                （就地填当前这一组）反而被跳过了，而它才是常用的。 */}
            {toggleable && expanded ? (
              <button className="parameterExpandButton" type="button" onClick={() => setFullscreen(true)} aria-label="全屏填写全部参数" title="全屏填写全部参数"><Maximize2 size={15} /></button>
            ) : null}
            {toggleable ? (
              <ChevronDown className="parameterCardChevron" size={15} aria-hidden="true" />
            ) : null}
          </div>
        </header>
        {expanded ? (
          <>
            {mode === "collect" ? (
              <div className="parameterPages">
                {groups.map((group, index) => (
                  <button className={index === safePage ? "active" : ""} type="button" key={group.id} disabled={index > maxReachablePage} onClick={() => setPage(index)}>{group.title}</button>
                ))}
              </div>
            ) : null}
            <div className="warningDecisionList">
              {pageFields.length
                ? pageFields.map((field, index) => row(field, index + 1, (value) => selectValue(field, value)))
                : <p className="emptyPageNote">{pageGroup?.title}参数已齐全，可切换下一页继续补全。</p>}
            </div>
            <div className="parameterPager">
              <p className="responsibilityNote">{remaining ? `还需填写 ${remaining} 项` : "可继续调整，或直接发送"}</p>
              {mode === "collect" && safePage > 0 ? <div><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))}>上一页</button></div> : null}
            </div>
          </>
        ) : null}
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
