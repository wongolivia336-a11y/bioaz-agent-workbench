"use client";

import { Check, CircleAlert, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ResolvedInspectorPanel } from "../workbench-inspector/WorkbenchInspector";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";

/* 默认宽度不写在这里——各模块的 `--panel-width` 不一样（DMPK 320、QA 与肿瘤
   报告 400）。重置就是把内联覆盖删掉，让 CSS 里那份重新生效，再把量到的值读回来。 */
const PANEL_WIDTH_MIN = 320;
const PANEL_WIDTH_MAX = 760;
/** 对话列的下限。面板再宽也不能把中间那一列压到读不了。 */
const CONVERSATION_MIN_WIDTH = 420;

type PanelState = {
  panels: ResolvedInspectorPanel[];
  /** 当前显示的 tab 顺序按 panels 的注册顺序，不按勾选顺序，避免 tab 位置跳动 */
  visibleIds: string[];
  onVisibleIdsChange: (ids: string[]) => void;
  activePanelId: string;
  onPanelChange: (panelId: string) => void;
  /** 阶段推进过但用户没在看的 tab，打一个小圆点，不抢视图 */
  hintIds?: string[];
  /** 面板铺满工作区（只吃对话列，topbar 与左侧任务栏保留）。不传 onFocusChange 就没有这颗按钮 */
  focus?: boolean;
  onFocusChange?: (focus: boolean) => void;
};

/**
 * topbar 上的展开/收起按钮。它必须留在 topbar 而不是面板里——
 * 面板收起后自身不渲染，开关跟着消失就没有回来的路了。
 */
export function PanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [suppressHover, setSuppressHover] = useState(false);
  return (
    <button
      type="button"
      className={`tumorInspectorToggle ${open ? "isActive" : ""} ${suppressHover ? "suppressHover" : ""}`}
      title={open ? "收起右侧面板" : "展开右侧面板"}
      aria-label={open ? "收起右侧面板" : "展开右侧面板"}
      aria-pressed={open}
      onClick={() => { if (open) setSuppressHover(true); onToggle(); }}
      onMouseLeave={() => setSuppressHover(false)}
    >
      {open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
    </button>
  );
}

/**
 * 左侧那条分界线的抓手。
 *
 * 宽度写在**工作区**上而不是面板上——`--panel-width` 是工作区那条
 * grid-template-columns 读的值，写在面板自己身上，父级的列宽不会变。
 * 面板在三个模块里都是工作区的直接子元素，所以 parentElement 就是它。
 *
 * 拖动过程直接写 DOM 变量、不走 state：每帧 setState 会把整个面板重渲一遍，
 * 拖起来是顿的。宽度回到 state 只发生在松手和键盘调整时，用来报给读屏。
 */
function PanelResizer({ panelRef }: { panelRef: React.RefObject<HTMLElement> }) {
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(PANEL_WIDTH_MIN);
  const dragRef = useRef<{ pointerX: number; width: number } | null>(null);

  const workspace = () => panelRef.current?.parentElement ?? null;
  const measure = () => panelRef.current?.getBoundingClientRect().width ?? PANEL_WIDTH_MIN;

  // 报给读屏的初始值只能量出来，各模块的默认宽度不同
  useEffect(() => { setWidth(measure()); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (next: number) => {
    const room = workspace()?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY;
    const ceiling = Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, room - CONVERSATION_MIN_WIDTH));
    return Math.round(Math.min(Math.max(next, PANEL_WIDTH_MIN), ceiling));
  };

  const apply = (next: number) => {
    const settled = clamp(next);
    workspace()?.style.setProperty("--panel-width", `${settled}px`);
    return settled;
  };

  const reset = () => {
    workspace()?.style.removeProperty("--panel-width");
    setWidth(measure());
  };

  return (
    <div
      className={`workbenchPanelResizer ${dragging ? "isDragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整面板宽度"
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onDoubleClick={reset}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerX: event.clientX, width: measure() };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        // 面板在右边，所以向左拖是变宽
        apply(drag.width + (drag.pointerX - event.clientX));
      }}
      onPointerUp={(event) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setDragging(false);
        setWidth(measure());
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragging(false);
        setWidth(measure());
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") setWidth(apply(measure() + 24));
        else if (event.key === "ArrowRight") setWidth(apply(measure() - 24));
        else if (event.key === "Home") reset();
        else return;
        event.preventDefault();
      }}
    />
  );
}

/**
 * 面板本体，占满白卡右侧一整列（含顶栏那一行），左侧一条顶天立地的分界线。
 * tab 栏是它自己的头部，所以分界线两侧一眼能分出「对话」与「面板」。
 */
export function WorkbenchPanelBody({ panels, visibleIds, onVisibleIdsChange, activePanelId, onPanelChange, hintIds = [], open = true, focus = false, onFocusChange }: PanelState & { open?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const panelRef = useRef<HTMLElement>(null);

  const visiblePanels = panels.filter((panel) => visibleIds.includes(panel.id));
  const active = visiblePanels.find((panel) => panel.id === activePanelId) ?? visiblePanels[0];

  const hide = (panelId: string) => {
    // 至少留一个 tab，否则面板会变成一块没有出口的空白
    if (visibleIds.length === 1) return;
    const next = visibleIds.filter((id) => id !== panelId);
    onVisibleIdsChange(next);
    if (activePanelId === panelId) {
      const fallback = panels.find((panel) => next.includes(panel.id));
      if (fallback) onPanelChange(fallback.id);
    }
  };

  const toggleVisible = (panelId: string) => {
    if (visibleIds.includes(panelId)) { hide(panelId); return; }
    onVisibleIdsChange([...visibleIds, panelId]);
    onPanelChange(panelId);
  };

  return (
    <aside ref={panelRef} className={`workbenchPanel ${open ? "isOpen" : ""} ${focus ? "isFocus" : ""}`} aria-hidden={!open}>
      {/* 全屏态没有中间那一列可分，抓手就没有意义 */}
      {open && !focus ? <PanelResizer panelRef={panelRef} /> : null}
      <div className="workbenchPanelTabs">
        <div className="workbenchPanelTabScroll" role="tablist" aria-label="工作面板">
          {visiblePanels.map((panel) => {
            const Icon = panel.icon;
            const selected = panel.id === active?.id;
            return (
              <span className={`workbenchPanelTab ${selected ? "isActive" : ""}`} key={panel.id}>
                <button type="button" role="tab" aria-selected={selected} onClick={() => onPanelChange(panel.id)}>
                  <Icon size={14} />
                  <span>{panel.label}</span>
                  {!selected && hintIds.includes(panel.id) ? <i className="workbenchPanelTabDot" aria-label="有更新" /> : null}
                </button>
                {/* 叉号始终占位，只切换可见性——否则 hover 时 tab 变宽，整条栏会抖 */}
                <button
                  type="button"
                  className="workbenchPanelTabClose"
                  aria-label={`关闭${panel.label}`}
                  tabIndex={visiblePanels.length > 1 ? 0 : -1}
                  disabled={visiblePanels.length === 1}
                  onClick={() => hide(panel.id)}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
        <div ref={menuRef} className={`workbenchPanelAdd ${menuOpen ? "isOpen" : ""}`}>
          <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="添加面板" onClick={() => setMenuOpen((value) => !value)}>
            <Plus size={16} />
          </button>
          {menuOpen ? (
            <div className="workbenchPanelAddMenu" role="menu">
              {/* 分「主要 / 更多」两组：次要面板长期藏在这里，不分组的话
                  用户看不出哪三个才是常驻的 */}
              {([["主要", true], ["更多", false]] as const).map(([groupLabel, isPrimary]) => {
                const group = panels.filter((panel) => panel.primary === isPrimary);
                if (!group.length) return null;
                return (
                  <div className="workbenchPanelAddGroup" key={groupLabel}>
                    <span className="workbenchPanelAddMenuLabel">{groupLabel}</span>
                    {group.map((panel) => {
                      const Icon = panel.icon;
                      const checked = visibleIds.includes(panel.id);
                      return (
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          key={panel.id}
                          aria-checked={checked}
                          className={checked ? "isChecked" : ""}
                          onClick={() => toggleVisible(panel.id)}
                        >
                          <Icon size={14} />
                          <span>{panel.label}</span>
                          {checked ? <Check size={14} /> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        {/* 「加内容」与「改视图」是两组语义，中间一条淡竖线隔开。
            按钮常驻占位——当前 tab 不支持全屏时只置灰，不移除，
            否则加号会跟着 tab 切换左右横跳。 */}
        {onFocusChange ? (
          <div className="workbenchPanelViewActions">
            <span className="workbenchPanelActionDivider" aria-hidden="true" />
            {/* title 挂在外层的 span 上：disabled 的按钮在 Chrome 里不派发鼠标事件，
                提示挂在按钮自己身上就永远弹不出来，用户只看到一个没反应的灰按钮。 */}
            <span
              className="workbenchPanelFocusWrap"
              title={focus ? "退出全屏（Esc）" : active?.expandable ? "面板全屏" : "该面板放宽后没有更多内容"}
            >
              <button
                type="button"
                className={`workbenchPanelFocus ${focus ? "isActive" : ""}`}
                disabled={!focus && !active?.expandable}
                aria-pressed={focus}
                aria-label={focus ? "退出全屏" : "面板全屏"}
                onClick={() => onFocusChange(!focus)}
              >
                {focus ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </span>
          </div>
        ) : null}
      </div>
      <div className="workbenchPanelBody" role="tabpanel">
        {active ? <PanelContent panel={active} /> : null}
      </div>
    </aside>
  );
}

function PanelContent({ panel }: { panel: ResolvedInspectorPanel }) {
  if (panel.state === "error") {
    return <p className="workbenchPanelNotice isError"><CircleAlert size={14} />{panel.errorMessage ?? "内容暂时不可用"}</p>;
  }
  if (panel.state === "loading") {
    return <p className="workbenchPanelNotice">正在整理…</p>;
  }
  if (panel.state === "empty") {
    return <p className="workbenchPanelNotice">{panel.emptyMessage ?? "暂无内容"}</p>;
  }
  return <>{panel.content}</>;
}
