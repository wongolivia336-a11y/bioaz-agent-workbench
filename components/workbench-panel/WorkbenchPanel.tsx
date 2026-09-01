"use client";

import { Check, CircleAlert, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Plus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ResolvedInspectorPanel } from "../workbench-inspector/WorkbenchInspector";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";

/* 默认宽度不写在这里——各模块的 `--panel-width` 不一样（DMPK 320、QA 与肿瘤
   报告 400）。重置就是把内联覆盖删掉，让 CSS 里那份重新生效，再把量到的值读回来。 */
const PANEL_WIDTH_MIN = 320;
const PANEL_WIDTH_MAX = 760;
/** 对话列的下限。面板再宽也不能把中间那一列压到读不了。 */
const CONVERSATION_MIN_WIDTH = 420;

/* 并列
   ----------------------------------------------------------------------
   一列就是一个面板，所以列宽下限沿用面板下限。列数**不由用户直接选**，
   由量出来的宽度决定——勾了两个但屏幕放不下，硬排出来两列各 200px，
   两边都读不了。

   规则只有一条：前 cap-1 个各占一列，剩下的全挤进最后一列用 tab 切。
   cap = 1 时它退化成「所有面板都在最后一列」——也就是现在的样子，
   一个字节都没变。QA 与肿瘤报告不传 columns，走的正是这条。 */
const COLUMN_MIN_WIDTH = 320;
const COLUMN_GAP = 16;
const COLUMN_MAX = 3;

/** 这个宽度能排下几列 */
function columnCapacity(width: number) {
  if (!width) return 1;
  const fit = Math.floor((width + COLUMN_GAP) / (COLUMN_MIN_WIDTH + COLUMN_GAP));
  return Math.min(COLUMN_MAX, Math.max(1, fit));
}

/** 排 n 列需要多宽 */
function widthForColumns(n: number) {
  return n * COLUMN_MIN_WIDTH + (n - 1) * COLUMN_GAP;
}

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
  /* 允许并列。不传就是一列——QA 与肿瘤报告走这条，行为和以前完全一致。
     开了也不保证真能并列：排不排得下由量出来的宽度说了算。 */
  columns?: boolean;
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
export function WorkbenchPanelBody({ panels, visibleIds, onVisibleIdsChange, activePanelId, onPanelChange, hintIds = [], open = true, focus = false, onFocusChange, columns = false }: PanelState & { open?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const panelRef = useRef<HTMLElement>(null);

  const visiblePanels = panels.filter((panel) => visibleIds.includes(panel.id));

  /* 量的是**面板自己**，不是视口。
     受约束的是这一块的宽度：面板可拖、任务栏可收、全屏会把整条工作区让出来，
     这三件事都不改变视口。这个仓库里已经栽过两次同样的跟头
     （计算表、退回画布），所以这里一开始就用 ResizeObserver。 */
  const [panelWidth, setPanelWidth] = useState(0);

  /* 每次渲染都同步量一次。
     只挂 ResizeObserver 是不够的：它的回调要等到下一次渲染周期才送达，
     于是首帧永远按「一列」排，下一帧才翻成两列——勾选之后会看到明显的跳。
     useLayoutEffect 在提交后、绘制前跑，量到的就是本次的真实宽度。 */
  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node || !columns) return;
    const next = node.getBoundingClientRect().width;
    setPanelWidth((current) => (Math.abs(current - next) < 1 ? current : next));
  });

  /* 拖拽和收任务栏不引起本组件重渲，所以还要一个观察者兜住那些变化。 */
  useEffect(() => {
    const node = panelRef.current;
    if (!node || !columns) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      setPanelWidth((current) => (Math.abs(current - next) < 1 ? current : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [columns]);

  const capacity = columns ? columnCapacity(panelWidth) : 1;
  /* 前 cap-1 个各占一列，剩下的挤进最后一列用 tab 切。
     cap=1 时 leading 为空、trailing 是全部——即现状。 */
  const leadingPanels = visiblePanels.slice(0, Math.max(0, capacity - 1));
  const trailingPanels = visiblePanels.slice(Math.max(0, capacity - 1));
  const trailingActive = trailingPanels.find((panel) => panel.id === activePanelId) ?? trailingPanels[0];
  /* 勾了但排不下的：既不独占一列，也不是最后一列当前那个 tab。
     要说明白为什么，静默失败会被当成功能坏了。 */
  const crowded = columns && visiblePanels.length > capacity;

  /* 勾第二个的时候，如果面板还有加宽的余地就自动加宽——
     DMPK 默认 320，不加宽的话勾了也永远排不出第二列，
     用户看到的是「点了没反应」。 */
  const widenFor = (count: number) => {
    const workspace = panelRef.current?.parentElement;
    if (!workspace || !columns || focus) return;
    const current = panelRef.current?.getBoundingClientRect().width ?? 0;
    const room = workspace.getBoundingClientRect().width;
    /* 加宽的上限仍然是「不把对话列压穿」——面板可以变宽，
       但不能宽到让中间那一列读不了。 */
    const ceiling = Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, room - CONVERSATION_MIN_WIDTH));
    /* 排得下几列就加宽到几列，**不是装不下三列就干脆不加宽**。
       之前那版直接按目标列数算一个宽度，超了上限就整个放弃：
       勾第四个面板时它想要三列的 992，够不着 760，于是连能排的两列
       也一起没了——用户看到的还是「点了没反应」。 */
    let fits = 1;
    for (let n = Math.min(count, COLUMN_MAX); n > fits; n -= 1) {
      if (widthForColumns(n) <= ceiling) { fits = n; break; }
    }
    if (fits < 2) return;
    const need = widthForColumns(fits);
    if (current >= need) return;
    workspace.style.setProperty("--panel-width", `${Math.round(need)}px`);
  };

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
    /* 按**真正会渲染出来**的面板数算，不是 visibleIds 的长度。
       两者会差很多：visibleIds 记着用户勾过的全部，而 panels 里
       有一部分当前阶段还不可用（available 为假），根本不渲染。
       拿原始长度去算，会为了一个看不见的面板去要第三列的宽度。 */
    widenFor(visiblePanels.length + 1);
  };

  return (
    <aside
      ref={panelRef}
      className={`workbenchPanel ${open ? "isOpen" : ""} ${focus ? "isFocus" : ""} ${leadingPanels.length ? "isColumns" : ""}`}
      style={leadingPanels.length ? ({ "--panel-columns": leadingPanels.length + 1 } as React.CSSProperties) : undefined}
      aria-hidden={!open}
    >
      {/* 全屏态没有中间那一列可分，抓手就没有意义 */}
      {open && !focus ? <PanelResizer panelRef={panelRef} /> : null}

      {/* 各自独占一列的那几个。它们自带标题，不进 tab 栏——
          一条共享 tab 栏配几列内容，人分不清哪个 tab 对应哪一列。 */}
      {leadingPanels.map((panel) => {
        const Icon = panel.icon;
        return (
          <section className="workbenchPanelColumn" key={panel.id} aria-label={panel.label}>
            <header className="workbenchPanelColumnHead">
              <Icon size={14} />
              <strong>{panel.label}</strong>
              <button type="button" aria-label={`取消并列${panel.label}`} title="取消并列" onClick={() => hide(panel.id)}>
                <X size={12} />
              </button>
            </header>
            <div className="workbenchPanelColumnBody">
              <PanelContent panel={panel} />
            </div>
          </section>
        );
      })}

      <div className="workbenchPanelTabs">
        <div className="workbenchPanelTabScroll" role="tablist" aria-label="工作面板">
          {trailingPanels.map((panel) => {
            const Icon = panel.icon;
            const selected = panel.id === trailingActive?.id;
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
              title={focus ? "退出全屏（Esc）" : trailingActive?.expandable ? "面板全屏" : "该面板放宽后没有更多内容"}
            >
              <button
                type="button"
                className={`workbenchPanelFocus ${focus ? "isActive" : ""}`}
                disabled={!focus && !trailingActive?.expandable}
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
        {/* 勾了但排不下：说清楚为什么，以及怎么才排得下。
            只说「放不下」而不给出路，用户只会以为坏了。 */}
        {crowded ? (
          <p className="workbenchPanelCrowded">
            还有 {visiblePanels.length - capacity} 个面板没能并列显示，先用上面的标签切换。
            {focus ? "全屏下最多并列三个。" : "把面板往左拖宽，或收起左侧任务栏，就能多并一列。"}
          </p>
        ) : null}
        {trailingActive ? <PanelContent panel={trailingActive} /> : null}
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
