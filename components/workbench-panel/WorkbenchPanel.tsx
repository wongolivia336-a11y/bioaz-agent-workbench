"use client";

import { Check, CircleAlert, Columns2, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Plus, X } from "lucide-react";
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
  /* 哪几个面板要各自独占一列。不传就是一列——QA 与肿瘤报告走这条，
     行为和以前完全一致。传了也不保证真能并列：排不排得下由量出来的宽度说了算。

     它和 visibleIds 是两件事：visibleIds 说「有哪些标签」，
     columnIds 说「其中哪几个摊出来并排看」。少了这一层，
     列头上那个「合并」就只能实现成「关掉」——保留但不并列这个状态无处安放。 */
  columnIds?: string[];
  onColumnIdsChange?: (ids: string[]) => void;
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
export function WorkbenchPanelBody({ panels, visibleIds, onVisibleIdsChange, activePanelId, onPanelChange, hintIds = [], open = true, focus = false, onFocusChange, columnIds, onColumnIdsChange }: PanelState & { open?: boolean }) {
  const columns = Boolean(onColumnIdsChange);
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
  /* 摊出来的按 columnIds 的顺序排，不按注册顺序——顺序在这里是有意义的：
     退回处理这一屏是「先读批注、再改参数」，那就该从左往右这么摆。
     （标签栏仍按注册顺序，那边要的是位置稳定，不能跟着勾选跳。） */
  const requestedColumns = (columnIds ?? [])
    .map((id) => visiblePanels.find((panel) => panel.id === id))
    .filter((panel): panel is ResolvedInspectorPanel => Boolean(panel));
  // 最后一列留给标签，所以最多摊 cap-1 个
  const leadingPanels = requestedColumns.slice(0, Math.max(0, capacity - 1));
  const trailingPanels = visiblePanels.filter((panel) => !leadingPanels.includes(panel));
  const trailingActive = trailingPanels.find((panel) => panel.id === activePanelId) ?? trailingPanels[0];
  /* 只在**用户刚要求的并列没排下**时才说话。
     以前是「可见面板数 > 列数」就一直挂着——可标签比列多本来就是常态，
     那条提示于是长期占着批注列顶上那块地方，像在报错。 */
  const deniedColumns = requestedColumns.length - leadingPanels.length;

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
  };

  /* 摊成一列 / 收回标签栏。
     这一对取代了原来列头上那个叉——那个叉调的是 hide()，
     也就是把面板整个关掉，而用户想说的只是「不用并排了」。 */
  /* 加宽是对「要摊几列」的响应，不挂在某一次点击上——
     退回到达时是代码直接把 columnIds 填好的，没有点击可挂。

     算的是 requestedColumns（真正会渲染的），不是 columnIds 的长度：
     后者可能含当前阶段不可用、根本不渲染的面板，照它去要宽度，
     会为一个看不见的东西多要一列。 */
  useEffect(() => {
    if (requestedColumns.length) widenFor(requestedColumns.length + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedColumns.length]);

  const splitOut = (panelId: string) => {
    if (!onColumnIdsChange) return;
    onColumnIdsChange([...(columnIds ?? []).filter((id) => id !== panelId), panelId]);
  };

  const mergeBack = (panelId: string) => {
    onColumnIdsChange?.((columnIds ?? []).filter((id) => id !== panelId));
    // 收回来的那个直接成为当前标签，否则它会不声不响地藏进标签栏
    onPanelChange(panelId);
  };

  /* ── 拖着长出一列 ───────────────────────────────────────────────────
     按钮那条明路已经有了，这一层是叠上去的第二条路：顺手一拖就成，
     发现了就不会忘。它属于外壳而不是某个业务，所以 QA、肿瘤报告
     以及以后的新业务只要传了 columnIds 就一起有。

     只有一条规则，两个方向共用：**最后一列的左边界就是分界线。**
     把一个面板从右边拖到左边 → 摊成一列；从左边拖回右边 → 收回标签栏。
     两个方向不写成两套判断，否则它们迟早会长出各自的边界情况。

     用指针事件而不是 HTML5 拖放：这个仓库的抓手（面板改宽）已经是这么写的，
     而且原生拖放在触屏上根本不触发，拖影也没法跟着做「拎起来」那一下。 */
  const [drag, setDrag] = useState<{ id: string; label: string; x: number; y: number; toColumn: boolean } | null>(null);
  const dragRef = useRef<{ id: string; label: string; startX: number; startY: number; moved: boolean } | null>(null);

  /* 松手到底会发生什么——**只在这里算一次**。
     提示文案、落区高亮、占位列全都读它。

     以前提示和落区各自判断，于是出现过「拖的是标签、指针还在标签侧，
     提示却写着松手收回标签栏」——它其实什么都不会做。
     一个不会发生的动作被写成了承诺，比没有提示更糟。 */
  /* 再摊一列，宽度够不够？
     算的是「加宽到头之后」能排几列，不是此刻能排几列——落地时 widenFor
     会去争取那点宽度，判据得和它对齐，否则会把明明能成的拒掉。 */
  const maxCapacity = (() => {
    if (!columns) return 1;
    if (focus) return columnCapacity(panelWidth);
    const room = panelRef.current?.parentElement?.getBoundingClientRect().width ?? 0;
    const ceiling = Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, room - CONVERSATION_MIN_WIDTH));
    return columnCapacity(Math.max(panelWidth, ceiling));
  })();
  // 最后一列永远留给标签，所以能摊出来的是 maxCapacity - 1 个
  const canSplitMore = maxCapacity - 1 > leadingPanels.length;

  /* 松手到底会发生什么——**只在这里算一次**。
     提示文案、落区高亮、占位列全都读它。

     以前提示和落区各自判断，于是出现过「拖的是标签、指针还在标签侧，
     提示却写着松手收回标签栏」——它其实什么都不会做。
     一个不会发生的动作被写成了承诺，比没有提示更糟。

     "full" 是同一个毛病的另一半：宽度已经排不下第二列了，却照样画出
     占位列、写着「松手并列显示」，松手之后那一列并不会出现。
     许一个兑现不了的布局，比不许更伤——人会以为是坏了。 */
  const dragEffect: "split" | "merge" | "full" | "none" = !drag
    ? "none"
    : (columnIds ?? []).includes(drag.id)
      ? (drag.toColumn ? "none" : "merge")
      : (drag.toColumn ? (canSplitMore ? "split" : "full") : "none");

  /* 分界线：左边＝摊成一列，右边＝收回标签栏。

     已经有列的时候，它就是标签那一列的左边界——那条线是看得见的。

     一列都没有的时候不能照搬：标签栏此时占满整个面板，它的左边界
     就是面板的左边界，于是「左边」是一片不存在的区域，怎么拖都判成收回。
     所以这种情况下取面板左侧 40% 作为落区——人要把标签拖出去成一列，
     手自然是往左边甩的，40% 足够接得住，又不会近到贴着标签栏误触发。 */
  const splitBoundary = () => {
    const panel = panelRef.current;
    if (!panel) return Number.NEGATIVE_INFINITY;
    if (leadingPanels.length) {
      /* 必须是**直接子元素**那条标签栏。
         每一列内部现在也有一条自己的标签栏（结构统一之后的结果），
         不加 :scope > 的话 querySelector 抓到的是最左那一列的，
         它的左边界就是面板左边界——「左边」又成了不存在的区域，
         于是往左怎么拖都判成「回到原处」。 */
      const tabs = panel.querySelector(":scope > .workbenchPanelTabs");
      if (tabs) return tabs.getBoundingClientRect().left;
    }
    const rect = panel.getBoundingClientRect();
    return rect.left + rect.width * 0.4;
  };

  const beginDrag = (panelId: string, label: string) => (event: React.PointerEvent) => {
    if (!columns || event.button !== 0) return;
    dragRef.current = { id: panelId, label, startX: event.clientX, startY: event.clientY, moved: false };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state) return;
    /* 4px 阈值：不设的话，点一下标签切换会被当成一次零距离的拖拽，
       松手时按落点判定，于是「点一下」变成了随机地摊开或收回。 */
    if (!state.moved) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 4) return;
      state.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDrag({ id: state.id, label: state.label, x: event.clientX, y: event.clientY, toColumn: event.clientX < splitBoundary() });
  };

  const endDrag = (event: React.PointerEvent) => {
    const state = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!state?.moved) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const isColumn = (columnIds ?? []).includes(state.id);
    const wantsColumn = event.clientX < splitBoundary();
    // 拖回原来那一侧＝反悔，什么都不做
    if (wantsColumn === isColumn) return;
    /* 排不下就真的不做。写进 columnIds 而屏幕上不出现那一列，
       等于悄悄改了状态又不告诉人——刚才拖影已经说了「宽度不够」，
       这里就得跟它一致。 */
    if (wantsColumn && !canSplitMore) return;
    if (wantsColumn) splitOut(state.id); else mergeBack(state.id);
  };

  /* 拖过一次之后紧跟着的那下 click 要吃掉，否则松手会顺带切换标签。 */
  const swallowClickAfterDrag = (event: React.MouseEvent) => {
    if (drag || dragRef.current?.moved) { event.preventDefault(); event.stopPropagation(); }
  };

  return (
    <aside
      ref={panelRef}
      className={`workbenchPanel ${open ? "isOpen" : ""} ${focus ? "isFocus" : ""} ${leadingPanels.length || dragEffect === "split" ? "isColumns" : ""} ${dragEffect === "merge" ? "isDropToTabs" : ""}`}
      /* 拖出新列时先把网格多算一列，让占位块真的占住地方——
         人看到的是「松手之后就长这样」，而不是一片提示色。 */
      style={leadingPanels.length || dragEffect === "split"
        ? ({ "--panel-columns": leadingPanels.length + 1 + (dragEffect === "split" ? 1 : 0) } as React.CSSProperties)
        : undefined}
      aria-hidden={!open}
    >
      {/* 全屏态没有中间那一列可分，抓手就没有意义 */}
      {open && !focus ? <PanelResizer panelRef={panelRef} /> : null}

      {/* 摊出来的每一列，头部用的是**和标签栏同一套结构**：一条标签栏，
          里面只站着一个标签。

          上一版给它做了个纯标题的 header，结果两种列长得不是一个物种——
          一边是标题、一边是标签条，看上去像右侧塞了两个不同的模块。
          可它们本来就是同一件东西：一条标签栏被拆到了几列里。
          长相一致，层级才读得出来。

          「加面板」那颗加号只留在最后一列：它是整个面板的动作，
          不是某一列的，每列都放一个反而让人以为是往这一列里加。 */}
      {leadingPanels.map((panel) => {
        const Icon = panel.icon;
        return (
          <section className="workbenchPanelColumn" key={panel.id} aria-label={panel.label}>
            <div className="workbenchPanelTabs">
              <div className="workbenchPanelTabScroll" role="tablist" aria-label={panel.label}>
                <span className={`workbenchPanelTab isActive ${drag?.id === panel.id ? "isDragging" : ""}`}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected
                    onPointerDown={beginDrag(panel.id, panel.label)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <Icon size={14} />
                    <span>{panel.label}</span>
                  </button>
                  {/* 收回标签栏，不是关掉。这里曾经是叉号调 hide()，
                      于是「不用并排了」被执行成了「把这个面板关了」。 */}
                  <button
                    type="button"
                    className="workbenchPanelTabMerge"
                    aria-label={`把${panel.label}收回标签栏`}
                    title="收回标签栏"
                    onClick={() => mergeBack(panel.id)}
                  >
                    <PanelRightClose size={12} />
                  </button>
                </span>
              </div>
              {/* 全屏按钮每一列都有，管的是这一列自己那个面板。
                  少了它，摊出来的列反而比留在标签栏里少一个能力——
                  「退回批注」摊成列之后就没法铺成画布看原件了。 */}
              {onFocusChange && panel.expandable ? (
                <div className="workbenchPanelViewActions">
                  <span className="workbenchPanelActionDivider" aria-hidden="true" />
                  <button
                    type="button"
                    className="workbenchPanelFocus"
                    aria-label={`${panel.label}全屏`}
                    title="全屏"
                    onClick={() => { onPanelChange(panel.id); onFocusChange(true); }}
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="workbenchPanelBody" role="tabpanel">
              <PanelContent panel={panel} />
            </div>
          </section>
        );
      })}

      {/* 新列会落在这儿。画成一整列而不是给现有内容染色：
          要回答的是「它会变成什么样」，一个占住位置的空位说得比一层提示色清楚，
          而且旁边那几列会当场让开——布局先演一遍，再让人决定要不要。 */}
      {dragEffect === "split" ? (
        <div className="workbenchPanelDropSlot" aria-hidden="true">
          <span>{drag?.label}</span>
          <em>松手放这儿</em>
        </div>
      ) : null}

      <div className="workbenchPanelTabs">
        <div className="workbenchPanelTabScroll" role="tablist" aria-label="工作面板">
          {trailingPanels.map((panel) => {
            const Icon = panel.icon;
            const selected = panel.id === trailingActive?.id;
            return (
              <span className={`workbenchPanelTab ${selected ? "isActive" : ""} ${drag?.id === panel.id ? "isDragging" : ""}`} key={panel.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={(event) => { swallowClickAfterDrag(event); if (!event.defaultPrevented) onPanelChange(panel.id); }}
                  onPointerDown={beginDrag(panel.id, panel.label)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <Icon size={14} />
                  <span>{panel.label}</span>
                  {!selected && hintIds.includes(panel.id) ? <i className="workbenchPanelTabDot" aria-label="有更新" /> : null}
                </button>
                {/* 「并列」摆在叉号左边：把这个标签摊成自己的一列。
                    这一颗是给「我想同时看两块」用的最短路径——
                    原来只能去「添加面板」菜单里勾，而那个菜单读起来是
                    「有哪些标签」，不是「把这两个摆一起」。
                    排不下就置灰，但不移除：位置一空一现，整条栏会跟着抖。 */}
                {columns ? (
                  <button
                    type="button"
                    className="workbenchPanelTabSplit"
                    aria-label={`并列显示${panel.label}`}
                    title={capacity > 1 ? "并列显示" : "面板放宽后可并列显示"}
                    disabled={capacity < 2}
                    onClick={() => splitOut(panel.id)}
                  >
                    <Columns2 size={12} />
                  </button>
                ) : null}
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
        {/* 只有「要并列的排不下」才说话——标签比列多是常态，不是错。 */}
        {deniedColumns > 0 ? (
          <p className="workbenchPanelCrowded">
            还有 {deniedColumns} 个面板宽度不够，暂时留在标签里。
            {focus ? "全屏下最多并列三个。" : "把面板往左拖宽，或收起左侧任务栏。"}
          </p>
        ) : null}
        {trailingActive ? <PanelContent panel={trailingActive} /> : null}
      </div>

      {/* 跟着指针走的那一片。fixed 定位、不吃指针事件——
          它只是告诉人「手上拿着的是这个」，判定落点的始终是真实指针坐标。
          写成 transform 而不是 left/top：那两个每帧都要重排。 */}
      {drag ? (
        <span
          className={`workbenchPanelDragGhost ${dragEffect === "none" ? "isInert" : ""} ${dragEffect === "full" ? "isBlocked" : ""}`}
          style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0)` }}
          aria-hidden="true"
        >
          {drag.label}
          {/* 说的必须是**真的会发生的事**。回到原来那一侧就是什么都不发生，
              那就照实说「回到原处」并把整片提示压淡，而不是继续许一个
              松手之后并不会兑现的承诺。 */}
          <em>
            {dragEffect === "split" ? "松手并列显示"
              : dragEffect === "merge" ? "松手收回标签栏"
              : dragEffect === "full" ? "宽度不够，先拖宽面板"
              : "回到原处"}
          </em>
        </span>
      ) : null}
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
